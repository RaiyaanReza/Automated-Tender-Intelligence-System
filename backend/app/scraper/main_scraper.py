"""Main scraper runner for e-GP ingestion pipeline."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set
from urllib.parse import urljoin

import httpx

from app.ai.gemini_util import generate_tender_ai_summary
from .constants import (
    DEFAULT_API_BASE_URL,
    DEFAULT_MAX_PAGES,
    DEFAULT_TIMEOUT_MS,
    EGP_STD_TENDER_SEARCH_URL,
)
from .egp_browser import browser_session, make_browser_config
from .parser import extract_tender_details, extract_tender_list


@dataclass
class ScraperConfig:
    start_url: str = EGP_STD_TENDER_SEARCH_URL
    api_base_url: str = DEFAULT_API_BASE_URL
    max_pages: int = DEFAULT_MAX_PAGES
    timeout_ms: int = DEFAULT_TIMEOUT_MS
    debug: bool = False
    headless: Optional[bool] = None
    keyword: str = ""


def _priority_from_ai(ai_summary: Dict[str, Any]) -> str:
    risk_level = str(ai_summary.get("risk_level", "")).strip().lower()
    if risk_level == "high":
        return "High"
    if risk_level == "medium":
        return "Medium"
    if risk_level == "low":
        return "Low"
    return str(ai_summary.get("priority", "Low"))


def _load_existing_tender_ids(client: httpx.Client, api_base_url: str) -> Set[str]:
    response = client.get(f"{api_base_url}/tenders")
    response.raise_for_status()
    payload = response.json() or []
    return {
        str(item.get("tender_id", "")).strip()
        for item in payload
        if isinstance(item, dict) and item.get("tender_id")
    }


def _ingest_items(client: httpx.Client, api_base_url: str, items: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not items:
        return {"inserted": 0, "updated": 0, "received": 0}
    response = client.post(f"{api_base_url}/ingest/tenders", json={"items": items})
    response.raise_for_status()
    return response.json()


def _try_apply_keyword_search(page, keyword: str) -> None:
    if not keyword:
        return

    search_selectors = [
        "input[name='tenderName']",
        "input[name='keyword']",
        "input[type='search']",
        "input[type='text']",
    ]
    submit_selectors = [
        "button:has-text('Search')",
        "input[type='submit']",
        "button[type='submit']",
    ]

    for selector in search_selectors:
        locator = page.locator(selector)
        if locator.count() == 0:
            continue
        try:
            locator.first.fill(keyword)
            break
        except Exception:
            continue

    for selector in submit_selectors:
        locator = page.locator(selector)
        if locator.count() == 0:
            continue
        try:
            locator.first.click()
            page.wait_for_load_state("domcontentloaded")
            return
        except Exception:
            continue


def _goto_next_page(page) -> bool:
    next_selectors = [
        "a:has-text('Next')",
        "li.next a",
        "a[aria-label='Next']",
    ]

    for selector in next_selectors:
        locator = page.locator(selector)
        if locator.count() == 0:
            continue
        element = locator.first
        try:
            if not element.is_visible() or not element.is_enabled():
                continue
            element.click()
            page.wait_for_load_state("domcontentloaded")
            return True
        except Exception:
            continue
    return False


def run_scraper(config: Optional[ScraperConfig] = None) -> Dict[str, Any]:
    cfg = config or ScraperConfig()
    browser_cfg = make_browser_config(debug=cfg.debug, headless=cfg.headless)

    metrics = {
        "pages_scanned": 0,
        "rows_seen": 0,
        "new_rows": 0,
        "skipped_existing": 0,
        "ingested": {"inserted": 0, "updated": 0, "received": 0},
    }

    with httpx.Client(timeout=max(10.0, cfg.timeout_ms / 1000.0)) as api_client:
        existing_ids = _load_existing_tender_ids(api_client, cfg.api_base_url)
        items_to_ingest: List[Dict[str, Any]] = []

        with browser_session(browser_cfg) as (_, context, page):
            page.goto(cfg.start_url, wait_until="domcontentloaded")
            page.wait_for_selector("table tr")
            _try_apply_keyword_search(page, cfg.keyword)

            for _ in range(cfg.max_pages):
                page.wait_for_selector("table tr")
                listing_rows = extract_tender_list(page.content())
                metrics["pages_scanned"] += 1
                metrics["rows_seen"] += len(listing_rows)

                for row in listing_rows:
                    tender_id = (row.get("tender_id") or "").strip()
                    title = (row.get("title") or "").strip()
                    if not title:
                        continue

                    if not tender_id:
                        tender_id = f"EGP-AUTO-{abs(hash(title)) % 1000000000}"

                    if tender_id in existing_ids:
                        metrics["skipped_existing"] += 1
                        continue

                    details: Dict[str, Any] = {}
                    detail_url = (row.get("detail_url") or "").strip()
                    if detail_url and not detail_url.lower().startswith("javascript"):
                        absolute_detail_url = urljoin(page.url, detail_url)
                        detail_page = context.new_page()
                        detail_page.set_default_timeout(cfg.timeout_ms)
                        try:
                            detail_page.goto(absolute_detail_url, wait_until="domcontentloaded")
                            detail_page.wait_for_load_state("networkidle")
                            details = extract_tender_details(detail_page.content())
                        finally:
                            detail_page.close()

                    eligibility = str(details.get("eligibility", ""))
                    location = str(details.get("location", ""))
                    ai_summary = generate_tender_ai_summary(
                        title=title,
                        eligibility=eligibility,
                        location=location,
                    )

                    item = {
                        "tender_id": tender_id,
                        "title": title,
                        "organization": row.get("organization") or location or "Unknown Organization",
                        "description": details.get("description") or eligibility,
                        "value": details.get("tender_security_amount") or None,
                        "priority": _priority_from_ai(ai_summary),
                        "status": "new",
                        "ai_summary": ai_summary,
                    }
                    items_to_ingest.append(item)
                    existing_ids.add(tender_id)
                    metrics["new_rows"] += 1

                if not _goto_next_page(page):
                    break

        ingest_result = _ingest_items(api_client, cfg.api_base_url, items_to_ingest)
        metrics["ingested"] = ingest_result

    return metrics


if __name__ == "__main__":
    result = run_scraper(ScraperConfig(debug=True, headless=False, max_pages=2))
    print(result)

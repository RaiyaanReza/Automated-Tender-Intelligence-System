"""Main scraper runner for e-GP ingestion pipeline."""

from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Set
from urllib.parse import urljoin
import os
import math

import httpx

from app.ai.gemini_util import generate_tender_ai_summary
from .constants import (
    DEFAULT_API_BASE_URL,
    DEFAULT_KEYWORDS,
    DEFAULT_MAX_PAGES,
    MAX_DEADLINE_WINDOW_DAYS,
    MAX_ITEMS_PER_CYCLE,
    DEFAULT_TIMEOUT_MS,
    EGP_ADVANCED_SEARCH_URL,
    EGP_STD_TENDER_SEARCH_URL,
    KEYWORD_SEARCH_PLAN,
)
from .egp_browser import browser_session, make_browser_config
from .notifier import send_telegram_alert
from .parser import (
    download_and_extract_pdf_text,
    download_pdf_bytes,
    extract_pdf_text_from_bytes,
    extract_tender_details,
    extract_tender_list,
)


@dataclass
class ScraperConfig:
    start_url: str = EGP_STD_TENDER_SEARCH_URL
    advanced_url: str = EGP_ADVANCED_SEARCH_URL
    api_base_url: str = DEFAULT_API_BASE_URL
    max_pages: int = DEFAULT_MAX_PAGES
    timeout_ms: int = DEFAULT_TIMEOUT_MS
    debug: bool = False
    headless: Optional[bool] = None
    keyword: str = ""
    proc_nature: str = ""
    keywords: Optional[List[str]] = None
    max_deadline_window_days: int = MAX_DEADLINE_WINDOW_DAYS
    max_items_per_cycle: int = MAX_ITEMS_PER_CYCLE
    save_pdf: bool = False
    download_dir: str = "downloads/tenders"
    publish_from: str = "01-Feb-2026"
    publish_to: str = ""
    stop_requested: Optional[Callable[[], bool]] = None


def _should_prioritize_title(title: str) -> bool:
    lowered = title.lower()
    markers = ["bandwidth", "dedicated", "internet service", "isp"]
    return any(marker in lowered for marker in markers)


def _priority_from_ai(ai_summary: Dict[str, Any]) -> str:
    risk_level = str(ai_summary.get("risk_level", "")).strip().lower()
    if risk_level == "high":
        return "High"
    if risk_level == "medium":
        return "Medium"
    if risk_level == "low":
        return "Low"
    return str(ai_summary.get("priority", "Low"))


def _load_existing_tenders(client: httpx.Client, api_base_url: str) -> Dict[str, Dict[str, Any]]:
    response = client.get(f"{api_base_url}/tenders")
    response.raise_for_status()
    payload = response.json() or []
    result: Dict[str, Dict[str, Any]] = {}
    for item in payload:
        if not isinstance(item, dict):
            continue
        tender_id = str(item.get("tender_id", "")).strip()
        if not tender_id:
            continue
        result[tender_id] = item
    return result


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


def _matches_keyword(keyword: str, *fields: str) -> bool:
    target = str(keyword or "").strip().lower()
    if not target:
        return True

    haystack = " ".join(str(field or "") for field in fields).lower()
    if not haystack:
        return False

    if target in haystack:
        return True

    terms = [token for token in target.replace("/", " ").replace("-", " ").split() if token]
    if not terms:
        return False
    return all(term in haystack for term in terms)


def _try_apply_advanced_search(page, keyword: str, proc_nature: str, publish_from: str = "", publish_to: str = "") -> bool:
    """Try advanced search form selectors used by e-GP."""
    if not keyword and not proc_nature:
        return False

    applied = False
    keyword_selectors = ["#txtKeyword", "input[name='keyword']", "#keyWord"]
    for selector in keyword_selectors:
        locator = page.locator(selector)
        if locator.count() == 0:
            continue
        try:
            locator.first.fill(keyword)
            applied = True
            break
        except Exception:
            continue

    if proc_nature:
        nature_selectors = ["#procNature", "select[name='procNature']"]
        for selector in nature_selectors:
            locator = page.locator(selector)
            if locator.count() == 0:
                continue
            try:
                locator.first.select_option(label=proc_nature)
                applied = True
                break
            except Exception:
                try:
                    locator.first.select_option(value=proc_nature)
                    applied = True
                    break
                except Exception:
                    continue

    if publish_from:
        for selector in ["#pubDtFrm", "input[name='pubDtFrm']"]:
            loc = page.locator(selector)
            if loc.count() == 0:
                continue
            try:
                loc.first.fill(publish_from)
                applied = True
                break
            except Exception:
                continue

    if publish_to:
        for selector in ["#pubDtTo", "input[name='pubDtTo']"]:
            loc = page.locator(selector)
            if loc.count() == 0:
                continue
            try:
                loc.first.fill(publish_to)
                applied = True
                break
            except Exception:
                continue

    submit_selectors = [
        "#btnSearch",
        "input[name='search']",
        "#btnKeyword",
        "input[type='button'][value='Search']",
        "input[type='submit'][value='Search']",
    ]
    for selector in submit_selectors:
        locator = page.locator(selector)
        if locator.count() == 0:
            continue
        try:
            locator.first.click()
            page.wait_for_load_state("domcontentloaded")
            page.wait_for_selector("table tr")
            return True
        except Exception:
            continue

    return applied


def _within_deadline_window(iso_deadline: str, window_days: int) -> bool:
    if not iso_deadline:
        return False
    try:
        deadline = datetime.fromisoformat(iso_deadline)
    except Exception:
        return False
    now = datetime.utcnow()
    return (now - timedelta(days=window_days)) <= deadline <= (now + timedelta(days=window_days))


def _is_stop_requested(cfg: ScraperConfig) -> bool:
    checker = cfg.stop_requested
    if not checker:
        return False
    try:
        return bool(checker())
    except Exception:
        return False


def _save_pdf_if_needed(cfg: ScraperConfig, tender_id: str, pdf_url: str) -> Optional[str]:
    if not (cfg.save_pdf and pdf_url):
        return None
    data, source_name = download_pdf_bytes(pdf_url, timeout=max(20, cfg.timeout_ms // 1000))
    if not data:
        return None

    out_dir = Path(cfg.download_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"{tender_id}-{source_name}" if source_name else f"{tender_id}.pdf"
    file_path = out_dir / file_name
    if file_path.exists():
        return str(file_path)
    file_path.write_bytes(data)
    return str(file_path)


def _capture_pdf_via_button(detail_page, cfg: ScraperConfig, tender_id: str) -> Optional[str]:
    """Use Playwright download event to capture Save As PDF output from detail page."""
    if not cfg.save_pdf:
        return None

    selectors = [
        "input[value*='Save As PDF']",
        "button:has-text('Save As PDF')",
        "text=Save As PDF",
    ]
    out_dir = Path(cfg.download_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    for selector in selectors:
        locator = detail_page.locator(selector)
        if locator.count() == 0:
            continue
        try:
            with detail_page.expect_download(timeout=12000) as download_info:
                locator.first.click()
            download = download_info.value
            suggested = download.suggested_filename or "tender.pdf"
            if not suggested.lower().endswith(".pdf"):
                suggested = f"{suggested}.pdf"
            safe_name = "".join(ch for ch in suggested if ch.isalnum() or ch in {"-", "_", "."})
            if not safe_name:
                safe_name = "tender.pdf"
            file_path = out_dir / f"{tender_id}-{safe_name}"
            download.save_as(str(file_path))
            if file_path.exists() and file_path.stat().st_size > 0:
                return str(file_path)
        except Exception:
            continue
    return None


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
        "skipped_deadline": 0,
        "stopped": False,
        "ingested": {"inserted": 0, "updated": 0, "received": 0},
        "alerts": {"status": "skipped", "reason": "not-run"},
    }

    with httpx.Client(timeout=max(10.0, cfg.timeout_ms / 1000.0)) as api_client:
        existing_tenders = _load_existing_tenders(api_client, cfg.api_base_url)
        existing_ids = set(existing_tenders.keys())
        queued_ids: Set[str] = set()
        items_to_ingest: List[Dict[str, Any]] = []
        inserted_candidates: List[Dict[str, Any]] = []

        plan: List[Dict[str, str]] = []
        if cfg.keyword:
            plan = [{"keyword": cfg.keyword, "proc_nature": cfg.proc_nature or ""}]
        elif cfg.keywords:
            plan = [{"keyword": keyword, "proc_nature": ""} for keyword in cfg.keywords]
        else:
            plan = [{"keyword": x["keyword"], "proc_nature": x["proc_nature"]} for x in KEYWORD_SEARCH_PLAN]
            if not plan:
                plan = [{"keyword": keyword, "proc_nature": ""} for keyword in DEFAULT_KEYWORDS]

        with browser_session(browser_cfg) as (_, context, page):
            per_query_cap = max(1, math.ceil(cfg.max_items_per_cycle / max(1, len(plan))))
            for query in plan:
                if _is_stop_requested(cfg):
                    metrics["stopped"] = True
                    break

                if len(items_to_ingest) >= cfg.max_items_per_cycle:
                    break

                query_inserted = 0

                page.goto(cfg.advanced_url, wait_until="domcontentloaded")
                page.wait_for_selector("table tr")

                keyword = query.get("keyword", "")
                proc_nature = query.get("proc_nature", "")
                if not _try_apply_advanced_search(
                    page,
                    keyword=keyword,
                    proc_nature=proc_nature,
                    publish_from=cfg.publish_from,
                    publish_to=cfg.publish_to,
                ):
                    _try_apply_keyword_search(page, keyword)

                for _ in range(cfg.max_pages):
                    if _is_stop_requested(cfg):
                        metrics["stopped"] = True
                        break

                    page.wait_for_selector("table tr")
                    listing_rows = extract_tender_list(page.content())
                    metrics["pages_scanned"] += 1
                    metrics["rows_seen"] += len(listing_rows)

                    for row in listing_rows:
                        if _is_stop_requested(cfg):
                            metrics["stopped"] = True
                            break

                        if len(items_to_ingest) >= cfg.max_items_per_cycle:
                            break

                        if query_inserted >= per_query_cap:
                            break

                        tender_id = (row.get("tender_id") or "").strip()
                        title = (row.get("title") or "").strip()
                        if not title:
                            continue

                        if not tender_id:
                            tender_id = f"EGP-AUTO-{abs(hash(title)) % 1000000000}"

                        if tender_id in queued_ids:
                            continue

                        if tender_id in existing_ids:
                            existing = existing_tenders.get(tender_id, {})
                            ai_existing = existing.get("ai_summary") if isinstance(existing, dict) else {}
                            has_pdf = isinstance(ai_existing, dict) and bool(str(ai_existing.get("pdf_saved_path", "")).strip())
                            if has_pdf:
                                metrics["skipped_existing"] += 1
                                continue

                        closing_date = str(row.get("closing_date", ""))
                        publishing_date = str(row.get("publishing_date", ""))
                        if not _within_deadline_window(closing_date, cfg.max_deadline_window_days):
                            metrics["skipped_deadline"] += 1
                            continue

                        details: Dict[str, Any] = {}
                        absolute_detail_url = ""
                        saved_pdf_path = None
                        detail_url = (row.get("detail_url") or "").strip()
                        if detail_url and not detail_url.lower().startswith("javascript"):
                            absolute_detail_url = urljoin(page.url, detail_url)
                            detail_page = context.new_page()
                            detail_page.set_default_timeout(cfg.timeout_ms)
                            try:
                                detail_page.goto(absolute_detail_url, wait_until="domcontentloaded")
                                detail_page.wait_for_load_state("networkidle")
                                details = extract_tender_details(detail_page.content())

                                # Preferred path: capture PDF via native Save As PDF button.
                                saved_pdf_path = _capture_pdf_via_button(detail_page, cfg, tender_id)
                            finally:
                                detail_page.close()

                        eligibility = str(details.get("eligibility", ""))
                        location = str(details.get("location", ""))

                        if keyword and not _matches_keyword(
                            keyword,
                            title,
                            row.get("organization"),
                            eligibility,
                            details.get("description", ""),
                        ):
                            continue

                        save_as_pdf_url = str(details.get("save_as_pdf_url", ""))
                        absolute_pdf_url = urljoin(page.url, save_as_pdf_url) if save_as_pdf_url else ""
                        pdf_text = ""
                        if saved_pdf_path and Path(saved_pdf_path).exists():
                            pdf_bytes = Path(saved_pdf_path).read_bytes()
                            pdf_text = extract_pdf_text_from_bytes(pdf_bytes)

                        if absolute_pdf_url and len(eligibility) < 80:
                            pdf_text = download_and_extract_pdf_text(absolute_pdf_url)
                            if pdf_text:
                                eligibility = (eligibility + "\n" + pdf_text[:5000]).strip()

                        ai_summary = generate_tender_ai_summary(
                            title=title,
                            eligibility=eligibility,
                            location=location,
                        )
                        if _should_prioritize_title(title):
                            ai_summary["priority_boost_reason"] = "keyword-match"
                            ai_summary["risk_level"] = "High"

                        if not saved_pdf_path:
                            saved_pdf_path = _save_pdf_if_needed(cfg, tender_id, absolute_pdf_url)

                        source_url = (
                            absolute_detail_url
                            if absolute_detail_url
                            else f"https://www.eprocure.gov.bd/resources/common/ViewTender.jsp?id={tender_id}&h=t"
                        )

                        detail_fields = details.get("detail_fields") if isinstance(details, dict) else {}
                        if not isinstance(detail_fields, dict):
                            detail_fields = {}

                        item = {
                            "tender_id": tender_id,
                            "title": title,
                            "organization": row.get("organization") or location or "Unknown Organization",
                            "description": details.get("description") or eligibility,
                            "value": details.get("tender_security_amount") or None,
                            "priority": _priority_from_ai(ai_summary),
                            "status": "new",
                            "deadline": closing_date or None,
                            "ai_summary": {
                                **ai_summary,
                                "keyword": keyword,
                                "proc_nature": proc_nature,
                                "publishing_date": publishing_date,
                                "detail_url": detail_url,
                                "source_url": source_url,
                                "save_as_pdf_url": absolute_pdf_url,
                                "tender_security_amount": details.get("tender_security_amount", ""),
                                "location": details.get("location", ""),
                                "eligibility": details.get("eligibility", ""),
                                "detail_fields": detail_fields,
                                "pdf_saved_path": saved_pdf_path or "",
                            },
                        }
                        items_to_ingest.append(item)
                        inserted_candidates.append(item)
                        queued_ids.add(tender_id)
                        existing_ids.add(tender_id)
                        metrics["new_rows"] += 1
                        query_inserted += 1

                    if len(items_to_ingest) >= cfg.max_items_per_cycle:
                        break
                    if metrics["stopped"]:
                        break
                    if not _goto_next_page(page):
                        break

                if metrics["stopped"]:
                    break

        ingest_result = _ingest_items(api_client, cfg.api_base_url, items_to_ingest)
        metrics["ingested"] = ingest_result
        if metrics["stopped"] and ingest_result.get("inserted", 0) == 0:
            metrics["alerts"] = {"status": "skipped", "reason": "stopped"}
        elif ingest_result.get("inserted", 0) > 0:
            metrics["alerts"] = send_telegram_alert(inserted_candidates)
        else:
            metrics["alerts"] = {"status": "skipped", "reason": "nothing inserted"}

    return metrics


if __name__ == "__main__":
    result = run_scraper(
        ScraperConfig(
            debug=True,
            headless=False,
            max_pages=1,
            save_pdf=bool(os.getenv("SAVE_TENDER_PDFS", "").strip()),
        )
    )
    print(result)

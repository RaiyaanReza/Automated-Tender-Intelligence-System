"""HTML parsing utilities for e-GP list and detail pages."""

from __future__ import annotations

import re
from typing import Any, Dict, List

from bs4 import BeautifulSoup


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip()


def _extract_tender_id(text: str) -> str:
    if not text:
        return ""
    match = re.search(r"\b\d{6,}\b", text)
    return match.group(0) if match else ""


def _extract_detail_url(link_tag) -> str:
    if not link_tag:
        return ""

    href = _clean_text(link_tag.get("href", ""))
    if href and not href.lower().startswith("javascript"):
        return href

    onclick = _clean_text(link_tag.get("onclick", ""))
    if not onclick:
        return ""

    match = re.search(r"(ViewTender\.jsp[^'\"\s)]+)", onclick, flags=re.IGNORECASE)
    if match:
        return match.group(1)
    return ""


def extract_tender_list(html: str) -> List[Dict[str, str]]:
    """Extract list page rows into lightweight tender dictionaries.

    Returns dictionaries with keys: tender_id, title, organization, detail_url.
    """
    soup = BeautifulSoup(html or "", "html.parser")
    rows = []
    seen_keys = set()

    for tr in soup.select(".table-responsive tr, table tr"):
        cells = tr.find_all("td")
        if len(cells) < 2:
            continue

        row_text = _clean_text(tr.get_text(" ", strip=True))
        link = tr.find("a", href=True)
        title = _clean_text(link.get_text(" ", strip=True) if link else cells[1].get_text(" ", strip=True))
        tender_id = _extract_tender_id(_clean_text(cells[0].get_text(" ", strip=True)))
        if not tender_id:
            tender_id = _extract_tender_id(row_text)

        organization = ""
        if len(cells) >= 3:
            organization = _clean_text(cells[2].get_text(" ", strip=True))

        detail_url = _extract_detail_url(link)
        if not title:
            continue

        dedupe_key = tender_id or title.lower()
        if dedupe_key in seen_keys:
            continue
        seen_keys.add(dedupe_key)

        rows.append(
            {
                "tender_id": tender_id,
                "title": title,
                "organization": organization,
                "detail_url": detail_url,
            }
        )

    return rows


_DETAIL_LABEL_MAP = {
    "eligibility of tenderer": "eligibility",
    "tender security amount": "tender_security_amount",
    "location": "location",
}


def extract_tender_details(html: str) -> Dict[str, Any]:
    """Extract detail fields from ViewTender-style pages."""
    soup = BeautifulSoup(html or "", "html.parser")
    details: Dict[str, Any] = {
        "eligibility": "",
        "tender_security_amount": "",
        "location": "",
        "description": "",
        "save_as_pdf_url": "",
    }

    # Parse common table layout where left cell contains field names.
    for tr in soup.select("tr"):
        cells = tr.find_all(["th", "td"])
        if len(cells) < 2:
            continue
        label = _clean_text(cells[0].get_text(" ", strip=True)).rstrip(":").lower()
        value = _clean_text(cells[1].get_text(" ", strip=True))
        if not label or not value:
            continue
        if label in _DETAIL_LABEL_MAP:
            details[_DETAIL_LABEL_MAP[label]] = value

    # Fallback parser for sections that render as plain text blocks.
    full_text = _clean_text(soup.get_text("\n", strip=True))
    if not details["eligibility"]:
        match = re.search(
            r"Eligibility of Tenderer\s*:?\s*(.+?)(?:Tender Security Amount|Location|$)",
            full_text,
            flags=re.IGNORECASE,
        )
        if match:
            details["eligibility"] = _clean_text(match.group(1))

    if not details["tender_security_amount"]:
        match = re.search(
            r"Tender Security Amount\s*:?\s*(.+?)(?:Location|$)",
            full_text,
            flags=re.IGNORECASE,
        )
        if match:
            details["tender_security_amount"] = _clean_text(match.group(1))

    if not details["location"]:
        match = re.search(r"Location\s*:?\s*(.+?)(?:$)", full_text, flags=re.IGNORECASE)
        if match:
            details["location"] = _clean_text(match.group(1))

    info_parts = [
        details["eligibility"],
        details["tender_security_amount"],
        details["location"],
    ]
    details["description"] = " | ".join([part for part in info_parts if part])

    pdf_link = soup.find("a", href=True, string=re.compile("save as pdf", flags=re.IGNORECASE))
    if not pdf_link:
        pdf_link = soup.find("a", href=True, attrs={"title": re.compile("pdf", flags=re.IGNORECASE)})
    if pdf_link:
        details["save_as_pdf_url"] = _clean_text(pdf_link["href"])

    return details


def parse_tender(raw_content: bytes, content_type: str) -> Dict[str, Any]:
    """Compatibility helper retained for legacy import paths."""
    html = raw_content.decode("utf-8", errors="ignore")
    if content_type.lower() == "html":
        rows = extract_tender_list(html)
        return rows[0] if rows else {}
    return {}

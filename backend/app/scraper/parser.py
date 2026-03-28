"""HTML parsing utilities for e-GP list and detail pages."""

from __future__ import annotations

import io
from datetime import datetime
from email.utils import parsedate_to_datetime
import httpx
import PyPDF2
import re
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

from bs4 import BeautifulSoup


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip()


def _sanitize_detail_text(value: str) -> str:
    text = _clean_text(value)
    if not text:
        return ""
    noise_patterns = [
        r"save\s*as\s*pdf",
        r"download\s*(document|file)",
        r"view\s*tender",
        r"back\s*to\s*list",
        r"print",
        r"home\s*>\s*tender",
    ]
    for pattern in noise_patterns:
        text = re.sub(pattern, " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+", " ", text)
    return text.strip(" |")


def _normalize_label_key(label: str) -> str:
    cleaned = _clean_text(label).lower().rstrip(":")
    cleaned = re.sub(r"[^a-z0-9]+", "_", cleaned)
    return cleaned.strip("_")

def download_and_extract_pdf_text(pdf_url: str, timeout: int = 30) -> str:
    """Download a PDF from an absolute URL and extract its text into a string."""
    if not pdf_url:
        return ""
    try:
        # Avoid verifying strict SSL if e-GP portal has issues
        with httpx.Client(timeout=timeout, verify=False) as client:
            resp = client.get(pdf_url)
            resp.raise_for_status()
            reader = PyPDF2.PdfReader(io.BytesIO(resp.content))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception as e:
        print(f"Failed to fetch or parse PDF from {pdf_url}: {e}")
        return ""


def extract_pdf_text_from_bytes(pdf_data: bytes) -> str:
    """Extract text from in-memory PDF bytes."""
    if not pdf_data:
        return ""
    try:
        reader = PyPDF2.PdfReader(io.BytesIO(pdf_data))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception as e:
        print(f"Failed to parse PDF bytes: {e}")
        return ""


def download_pdf_bytes(pdf_url: str, timeout: int = 30) -> Tuple[bytes, str]:
    """Download PDF as bytes and return optional filename from headers/url."""
    if not pdf_url:
        return b"", ""
    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.get(pdf_url)
            resp.raise_for_status()
            content_type = (resp.headers.get("content-type") or "").lower()
            data = resp.content or b""
            is_pdf = ("application/pdf" in content_type) or data.startswith(b"%PDF")
            if not is_pdf:
                return b"", ""

            filename = ""
            content_disposition = resp.headers.get("content-disposition", "")
            if "filename=" in content_disposition.lower():
                filename = content_disposition.split("filename=", 1)[-1].strip().strip('"')
            if not filename:
                path_name = urlparse(pdf_url).path.rsplit("/", 1)[-1]
                filename = path_name or "tender.pdf"
            if not filename.lower().endswith(".pdf"):
                filename = f"{filename}.pdf"
            return data, filename
    except Exception as e:
        print(f"Failed to download PDF from {pdf_url}: {e}")
        return b"", ""


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


def _extract_detail_url_from_onclick(tr, onclick_text: str) -> str:
    """Resolve detail URL from onclick='document.getElementById("viewtenderform_X").submit();'"""
    if not onclick_text:
        return ""

    form_match = re.search(r"getElementById\('([^']+)'\)", onclick_text)
    if not form_match:
        return ""

    form_id = form_match.group(1)
    form = tr.find("form", attrs={"id": form_id})
    if not form:
        return ""

    action = _clean_text(str(form.get("action", "")))
    if not action:
        return ""

    data = {}
    for inp in form.find_all("input"):
        name = _clean_text(str(inp.get("name", "")))
        value = _clean_text(str(inp.get("value", "")))
        if name:
            data[name] = value

    tender_id = data.get("id", "")
    h_val = data.get("h", "t")
    if tender_id:
        separator = "&" if "?" in action else "?"
        return f"{action}{separator}id={tender_id}&h={h_val or 't'}"
    return action


def _fallback_detail_url_from_row(tr) -> str:
    """Build ViewTender URL from hidden input fields when links are javascript placeholders."""
    tender_id_input = tr.find("input", attrs={"name": "id"})
    h_input = tr.find("input", attrs={"name": "h"})
    tender_id = _clean_text(str(tender_id_input.get("value", ""))) if tender_id_input else ""
    h_val = _clean_text(str(h_input.get("value", ""))) if h_input else "t"
    if tender_id:
        return f"ViewTender.jsp?id={tender_id}&h={h_val or 't'}"
    return ""


def _parse_datetime(value: str) -> Optional[str]:
    """Parse e-GP style datetime text and return ISO format."""
    text = _clean_text(value)
    if not text:
        return None

    patterns = [
        "%d-%b-%Y %H:%M",
        "%d-%b-%Y %H:%M:%S",
        "%d-%B-%Y %H:%M",
    ]
    for pattern in patterns:
        try:
            return datetime.strptime(text, pattern).isoformat()
        except Exception:
            continue

    try:
        return parsedate_to_datetime(text).isoformat()
    except Exception:
        return None


def extract_tender_list(html: str) -> List[Dict[str, str]]:
    """Extract list page rows into lightweight tender dictionaries.

    Returns dictionaries with keys: tender_id, title, organization, detail_url.
    """
    soup = BeautifulSoup(html or "", "html.parser")
    rows = []
    seen_keys = set()

    for tr in soup.select(".table-responsive tr, table tr"):
        cells = tr.find_all("td")
        # e-GP tender result rows are table-like with multiple columns.
        if len(cells) < 6:
            continue

        row_text = _clean_text(tr.get_text(" ", strip=True))
        link = cells[2].find("a", href=True) or tr.find("a", href=True)
        title = _clean_text(link.get_text(" ", strip=True) if link else cells[2].get_text(" ", strip=True))

        # Typical table has tender id in column 2 (index 1).
        tender_id = _extract_tender_id(_clean_text(cells[1].get_text(" ", strip=True)))
        if not tender_id:
            tender_id = _extract_tender_id(row_text)

        # Skip non-tender rows such as navigation blocks.
        if not tender_id:
            continue

        organization = ""
        if len(cells) >= 4:
            organization = _clean_text(cells[3].get_text(" ", strip=True))

        publishing_date_iso = None
        closing_date_iso = None
        date_text = _clean_text(cells[5].get_text(" ", strip=True))
        # e-GP column usually has publish date first and closing date second.
        candidates = [x.strip() for x in re.split(r",|\n", date_text) if x.strip()]
        if candidates:
            publishing_date_iso = _parse_datetime(candidates[0])
            closing_date_iso = _parse_datetime(candidates[-1])

        detail_url = _extract_detail_url(link)
        if not detail_url and link:
            detail_url = _extract_detail_url_from_onclick(tr, _clean_text(str(link.get("onclick", ""))))
        if not detail_url:
            detail_url = _fallback_detail_url_from_row(tr)
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
                "publishing_date": publishing_date_iso or "",
                "closing_date": closing_date_iso or "",
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
        "detail_fields": {},
    }

    detail_fields: Dict[str, str] = {}

    # Parse common table layout where left cell contains field names.
    for tr in soup.select("tr"):
        cells = tr.find_all(["th", "td"])
        if len(cells) < 2:
            continue
        label = _clean_text(cells[0].get_text(" ", strip=True)).rstrip(":").lower()
        value = _clean_text(cells[1].get_text(" ", strip=True))
        if not label or not value:
            continue
        key = _normalize_label_key(label)
        if key and key not in detail_fields:
            detail_fields[key] = _sanitize_detail_text(value)
        if label in _DETAIL_LABEL_MAP:
            details[_DETAIL_LABEL_MAP[label]] = _sanitize_detail_text(value)

    # Fallback parser for sections that render as plain text blocks.
    full_text = _clean_text(soup.get_text("\n", strip=True))
    if not details["eligibility"]:
        match = re.search(
            r"Eligibility of Tenderer\s*:?\s*(.+?)(?:Tender Security Amount|Location|$)",
            full_text,
            flags=re.IGNORECASE,
        )
        if match:
            details["eligibility"] = _sanitize_detail_text(match.group(1))

    if not details["tender_security_amount"]:
        match = re.search(
            r"Tender Security Amount\s*:?\s*(.+?)(?:Location|$)",
            full_text,
            flags=re.IGNORECASE,
        )
        if match:
            details["tender_security_amount"] = _sanitize_detail_text(match.group(1))

    if not details["location"]:
        match = re.search(r"Location\s*:?\s*(.+?)(?:$)", full_text, flags=re.IGNORECASE)
        if match:
            details["location"] = _sanitize_detail_text(match.group(1))

    info_parts = [
        details["eligibility"],
        details["tender_security_amount"],
        details["location"],
    ]
    details["description"] = _sanitize_detail_text(" | ".join([part for part in info_parts if part]))
    details["detail_fields"] = detail_fields

    pdf_link = soup.find("a", href=True, string=re.compile("save as pdf", flags=re.IGNORECASE))
    if not pdf_link:
        pdf_link = soup.find("a", href=True, attrs={"title": re.compile("pdf", flags=re.IGNORECASE)})
    if not pdf_link:
        pdf_link = soup.find("a", href=True, attrs={"href": re.compile(r"\.pdf($|\?)", flags=re.IGNORECASE)})
    if not pdf_link:
        pdf_link = soup.find("a", onclick=re.compile(r"pdf|save", flags=re.IGNORECASE))
    if pdf_link:
        href = str(pdf_link.get("href", ""))
        if not href and pdf_link.get("onclick"):
            onclick_text = _clean_text(str(pdf_link.get("onclick", "")))
            match = re.search(
                r"(TenderNotice\.jsp[^'\"\s)]*|[^'\"\s)]+\.pdf(?:\?[^'\"\s)]*)?)",
                onclick_text,
                flags=re.IGNORECASE,
            )
            if match:
                href = match.group(1)
        cleaned = _clean_text(href)
        if re.search(r"(\.pdf($|\?)|TenderNotice\.jsp)", cleaned, flags=re.IGNORECASE):
            details["save_as_pdf_url"] = cleaned

    if not details["save_as_pdf_url"]:
        for element in soup.select("[onclick]"):
            onclick_text = _clean_text(str(element.get("onclick", "")))
            if not onclick_text:
                continue
            match = re.search(
                r"(TenderNotice\.jsp[^'\"\s)]*|[^'\"\s)]+\.pdf(?:\?[^'\"\s)]*)?)",
                onclick_text,
                flags=re.IGNORECASE,
            )
            if not match:
                continue
            details["save_as_pdf_url"] = _clean_text(match.group(1))
            break

    return details


def parse_tender(raw_content: bytes, content_type: str) -> Dict[str, Any]:
    """Compatibility helper retained for legacy import paths."""
    html = raw_content.decode("utf-8", errors="ignore")
    if content_type.lower() == "html":
        rows = extract_tender_list(html)
        return rows[0] if rows else {}
    return {}

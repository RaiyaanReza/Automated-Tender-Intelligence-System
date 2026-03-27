"""
parser.py

Placeholder for parsing raw HTML/PDF content extracted by scrapers.

Responsibilities:
- Extract structured fields from tender pages/PDFs
- Normalize dates, currency, and organization names
- Return a consistent `Tender` dict for DB insertion
"""

from typing import Dict, Any


def parse_tender(raw_content: bytes, content_type: str) -> Dict[str, Any]:
    """Parse raw HTML or PDF bytes into a structured tender record.

    Args:
        raw_content: bytes from scraper
        content_type: 'html' or 'pdf'

    Returns:
        dict with normalized tender fields
    """
    raise NotImplementedError("parser.parse_tender must be implemented by backend team")

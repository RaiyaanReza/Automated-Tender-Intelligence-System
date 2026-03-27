"""Notification utilities for scraper events."""

from __future__ import annotations

import os
from typing import Dict, List
from urllib.parse import urljoin

import httpx

EGP_BASE_URL = "https://www.eprocure.gov.bd/resources/common/"


def _normalize_link(link: str) -> str:
    value = (link or "").strip()
    if not value:
        return ""
    if value.startswith("http://") or value.startswith("https://"):
        return value
    return urljoin(EGP_BASE_URL, value)


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name, "")
    if not raw:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _build_message(items: List[Dict]) -> str:
    top = items[:5]
    lines = ["ATIS: New relevant tenders detected"]
    for item in top:
        title = str(item.get("title", "Untitled"))
        tender_id = str(item.get("tender_id", "N/A"))
        priority = str(item.get("priority", "Low"))
        ai = item.get("ai_summary") if isinstance(item.get("ai_summary"), dict) else {}
        source_url = _normalize_link(str(ai.get("source_url") or ai.get("detail_url") or ""))
        text_snippet = str(item.get("description", "")).strip().replace("\n", " ")[:180]
        lines.append(f"- {tender_id} | {priority} | {title}")
        if text_snippet:
            lines.append(f"  Text: {text_snippet}")
        if source_url:
            lines.append(f"  Link: {source_url}")
    if len(items) > 5:
        lines.append(f"... and {len(items) - 5} more")
    return "\n".join(lines)


def send_telegram_alert(items: List[Dict]) -> Dict[str, str]:
    """Send Telegram alert for newly inserted tenders.

    Environment variables:
    - TELEGRAM_BOT_TOKEN
    - TELEGRAM_CHAT_ID
    - TELEGRAM_DRY_RUN=true to test without sending
    """
    if not items:
        return {"status": "skipped", "reason": "no items"}

    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    dry_run = _env_bool("TELEGRAM_DRY_RUN", default=False)

    message = _build_message(items)
    if dry_run:
        print("[TELEGRAM_DRY_RUN]", message)
        return {"status": "dry_run", "sent": str(len(items))}

    if not token or not chat_id:
        return {"status": "skipped", "reason": "token/chat_id missing"}

    endpoint = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "disable_web_page_preview": True,
    }
    try:
        with httpx.Client(timeout=20.0) as client:
            response = client.post(endpoint, json=payload)
            response.raise_for_status()
        return {"status": "sent", "count": str(len(items))}
    except Exception as exc:
        return {"status": "error", "reason": str(exc)}

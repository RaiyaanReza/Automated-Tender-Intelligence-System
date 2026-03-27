"""Gemini utility with graceful fallback when API key is unavailable."""

from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List

import httpx


def _extract_json_object(text: str) -> Dict[str, Any]:
    if not text:
        return {}
    try:
        return json.loads(text)
    except Exception:
        pass

    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not match:
        return {}
    try:
        return json.loads(match.group(0))
    except Exception:
        return {}


def _heuristic_requirements(eligibility: str) -> List[str]:
    tokens = [t.strip() for t in re.split(r"[.;,\n]", eligibility or "") if t.strip()]
    return tokens[:5]


def _heuristic_risk_level(title: str, eligibility: str) -> str:
    text = f"{title} {eligibility}".lower()
    high_markers = ["turnover", "experience", "license", "bank guarantee", "security amount"]
    medium_markers = ["certificate", "compliance", "timeline", "location"]
    if any(marker in text for marker in high_markers):
        return "High"
    if any(marker in text for marker in medium_markers):
        return "Medium"
    return "Low"


def _priority_from_risk(risk_level: str) -> str:
    mapping = {
        "high": "High",
        "medium": "Medium",
        "low": "Low",
    }
    return mapping.get((risk_level or "").strip().lower(), "Low")


def _gemini_generate(prompt: str, model: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return ""

    endpoint = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 700},
    }
    try:
        with httpx.Client(timeout=25.0) as client:
            response = client.post(endpoint, params={"key": api_key}, json=payload)
            response.raise_for_status()
            data = response.json()
    except Exception:
        return ""

    candidates = data.get("candidates") or []
    if not candidates:
        return ""
    parts = (((candidates[0] or {}).get("content") or {}).get("parts") or [])
    texts = [part.get("text", "") for part in parts if isinstance(part, dict)]
    return "\n".join([value for value in texts if value]).strip()


def summarize_text(text: str, options: Dict[str, Any] = None) -> str:
    """Return a concise summary using Gemini when configured, else fallback."""
    options = options or {}
    model = options.get("model") or os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    source_text = (text or "").strip()
    if not source_text:
        return ""

    prompt = (
        "Summarize the following tender content in 4 concise bullet points with practical"
        " procurement context.\n\n"
        f"Content:\n{source_text[:12000]}"
    )
    generated = _gemini_generate(prompt, model=model)
    if generated:
        return generated

    # Safe fallback that keeps pipeline operational without external API access.
    snippets = [s.strip() for s in re.split(r"[\n.]", source_text) if s.strip()]
    top = snippets[:4]
    if not top:
        return source_text[:300]
    return "\n".join([f"- {item}" for item in top])


def generate_tender_ai_summary(title: str, eligibility: str, location: str = "") -> Dict[str, Any]:
    """Create ai_summary payload compatible with existing backend/frontend fields."""
    model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    prompt = (
        "You are a procurement analysis assistant. Return ONLY valid JSON with these keys: "
        "risk_level (High/Medium/Low), fit (High/Medium/Low), notes (string), "
        "key_requirements (array of strings), recommendations (array of strings).\n\n"
        f"Title: {title}\n"
        f"Eligibility: {eligibility}\n"
        f"Location: {location}\n"
    )
    generated = _gemini_generate(prompt, model=model)
    parsed = _extract_json_object(generated)
    if parsed:
        return {
            "risk_level": str(parsed.get("risk_level", "Medium")),
            "fit": str(parsed.get("fit", "Medium")),
            "notes": str(parsed.get("notes", "AI analysis completed")),
            "key_requirements": parsed.get("key_requirements", []) or [],
            "recommendations": parsed.get("recommendations", []) or [],
            "priority": _priority_from_risk(str(parsed.get("risk_level", "Medium"))),
        }

    requirements = _heuristic_requirements(eligibility)
    risk_level = _heuristic_risk_level(title, eligibility)
    return {
        "risk_level": risk_level,
        "fit": "Medium" if risk_level == "Medium" else ("High" if risk_level == "Low" else "Low"),
        "notes": "Generated using local heuristic fallback because Gemini response was unavailable.",
        "key_requirements": requirements,
        "recommendations": [
            "Validate mandatory eligibility documents before bid submission.",
            "Confirm compliance and security deposit requirements.",
        ],
        "priority": _priority_from_risk(risk_level),
    }

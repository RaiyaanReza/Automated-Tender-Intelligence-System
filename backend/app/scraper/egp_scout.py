"""Compatibility wrapper that delegates to the scraper runner."""

from __future__ import annotations

from typing import Any, Dict

from .main_scraper import ScraperConfig, run_scraper


def run_scout(config: Dict[str, Any]) -> Dict[str, Any]:
    """Run scraper using a dictionary config for backward compatibility."""
    defaults = ScraperConfig()
    cfg = ScraperConfig(
        start_url=config.get("start_url", defaults.start_url),
        api_base_url=config.get("api_base_url", defaults.api_base_url),
        max_pages=int(config.get("max_pages", defaults.max_pages)),
        timeout_ms=int(config.get("timeout_ms", defaults.timeout_ms)),
        debug=bool(config.get("debug", False)),
        headless=config.get("headless"),
        keyword=str(config.get("keyword", "")),
    )
    return run_scraper(cfg)

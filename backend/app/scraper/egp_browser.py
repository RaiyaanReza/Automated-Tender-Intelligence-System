"""Playwright browser setup for e-GP scraping."""

from __future__ import annotations

import os
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Generator, Optional, Tuple

from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright

from .constants import DEFAULT_TIMEOUT_MS, DEFAULT_USER_AGENT


@dataclass
class BrowserConfig:
    headless: bool = True
    timeout_ms: int = DEFAULT_TIMEOUT_MS
    slow_mo_ms: int = 0
    user_agent: str = DEFAULT_USER_AGENT


def _env_to_bool(value: str, default: bool) -> bool:
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default


def make_browser_config(debug: bool = False, headless: Optional[bool] = None) -> BrowserConfig:
    """Create browser config.

    Priority:
    1) explicit headless argument
    2) EGP_SCRAPER_HEADLESS env
    3) debug flag (debug -> headed)
    4) default headless
    """
    if headless is not None:
        effective_headless = headless
    else:
        env_value = os.getenv("EGP_SCRAPER_HEADLESS")
        effective_headless = _env_to_bool(env_value, default=not debug)

    slow_mo = 200 if (debug and not effective_headless) else 0
    timeout_ms = int(os.getenv("EGP_SCRAPER_TIMEOUT_MS", str(DEFAULT_TIMEOUT_MS)))
    user_agent = os.getenv("EGP_SCRAPER_USER_AGENT", DEFAULT_USER_AGENT)
    return BrowserConfig(
        headless=effective_headless,
        timeout_ms=timeout_ms,
        slow_mo_ms=slow_mo,
        user_agent=user_agent,
    )


@contextmanager
def browser_session(
    config: Optional[BrowserConfig] = None,
) -> Generator[Tuple[Browser, BrowserContext, Page], None, None]:
    """Yield a configured browser, context, and page with safe cleanup."""
    cfg = config or BrowserConfig()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=cfg.headless, slow_mo=cfg.slow_mo_ms)
        context = browser.new_context(user_agent=cfg.user_agent)
        page = context.new_page()
        page.set_default_timeout(cfg.timeout_ms)
        try:
            yield browser, context, page
        finally:
            context.close()
            browser.close()

"""Scheduler wrapper to run the scraper every 30 minutes."""

import time
import logging
import os

from app.scraper.main_scraper import ScraperConfig, run_scraper
from app.scraper.constants import DEFAULT_MAX_PAGES, DEFAULT_REFRESH_MINUTES

# Setup basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def run_loop():
    refresh_minutes = int(os.getenv("SCRAPER_REFRESH_MINUTES", str(DEFAULT_REFRESH_MINUTES)))
    logger.info("Starting ATIS scraper scheduler.")
    logger.info("Cycle interval: %s minutes", refresh_minutes)
    
    while True:
        logger.info("--- Starting new scrape cycle ---")
        try:
            cfg = ScraperConfig(
                max_pages=int(os.getenv("SCRAPER_MAX_PAGES", str(DEFAULT_MAX_PAGES))),
                debug=False,
                headless=True,
                max_items_per_cycle=int(os.getenv("SCRAPER_MAX_ITEMS_PER_CYCLE", "10")),
                max_deadline_window_days=int(os.getenv("SCRAPER_DEADLINE_WINDOW_DAYS", "30")),
                publish_from=os.getenv("SCRAPER_PUBLISH_FROM", "01-Feb-2026"),
                publish_to=os.getenv("SCRAPER_PUBLISH_TO", ""),
                save_pdf=os.getenv("SAVE_TENDER_PDFS", "").strip().lower() in {"1", "true", "yes", "on"},
            )
            
            result = run_scraper(cfg)
            metrics = result.get("ingested", {})
            logger.info("Cycle complete. Stats: %s", result)
            logger.info(
                "Inserted=%s Updated=%s Received=%s SkippedExisting=%s SkippedDeadline=%s",
                metrics.get("inserted", 0),
                metrics.get("updated", 0),
                metrics.get("received", 0),
                result.get("skipped_existing", 0),
                result.get("skipped_deadline", 0),
            )
            
        except Exception as e:
            logger.error(f"Error during scrape cycle: {e}")

        logger.info("Sleeping for %s minutes", refresh_minutes)
        time.sleep(refresh_minutes * 60)

if __name__ == "__main__":
    run_loop()
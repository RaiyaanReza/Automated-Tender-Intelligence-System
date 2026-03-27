"""Constants and defaults for the e-GP scraper."""

EGP_STD_TENDER_SEARCH_URL = "https://www.eprocure.gov.bd/resources/common/StdTenderSearch.jsp?h=t"

# Keep this list short and editable so operators can tune scope quickly.
DEFAULT_KEYWORDS = [
    "software",
    "ICT",
    "network",
    "cyber",
    "cloud",
]

DEFAULT_TIMEOUT_MS = 30000
DEFAULT_MAX_PAGES = 5
DEFAULT_API_BASE_URL = "http://127.0.0.1:8000"

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)

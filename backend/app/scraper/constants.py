"""Constants and defaults for the e-GP scraper."""

EGP_STD_TENDER_SEARCH_URL = "https://www.eprocure.gov.bd/resources/common/StdTenderSearch.jsp?h=t"
EGP_ADVANCED_SEARCH_URL = "https://www.eprocure.gov.bd/resources/common/AllTenders.jsp?h=t"

# Weighted keyword map for ISP/network-focused tender discovery.
KEYWORD_GROUPS = {
    "core_services": [
        "Internet Service",
        "Bandwidth",
        "Supply of Bandwidth",
        "Connectivity",
        "Internet Connectivity",
        "Dedicated Internet",
        "ISP",
        "Last Mile",
    ],
    "infrastructure_fiber": [
        "Fiber Optic",
        "Optical Fiber",
        "Optical Fiber Network",
        "FTTH",
        "Underground Cabling",
        "Structured Cabling",
        "Splicing",
    ],
    "hardware_equipment": [
        "Networking Equipment",
        "Router",
        "Supply of Router",
        "Switch",
        "L2 Switch",
        "L3 Switch",
        "Media Converter",
        "OLT",
        "ONU",
        "Firewall",
        "Server Rack",
        "Access Point",
        "Wi-Fi Access Point",
    ],
    "managed_services": [
        "LAN",
        "WAN",
        "Wi-Fi Solution",
        "Network Maintenance",
        "NOC Support",
        "IP Surveillance",
        "Data Center Networking",
    ],
    "typo_variations": [
        "Fibber",
        "Internt",
        "Netwroking",
    ],
}

DEFAULT_KEYWORDS = [
    *KEYWORD_GROUPS["core_services"],
    *KEYWORD_GROUPS["infrastructure_fiber"],
    *KEYWORD_GROUPS["hardware_equipment"],
    *KEYWORD_GROUPS["managed_services"],
    *KEYWORD_GROUPS["typo_variations"],
]

# Each search pair drives one query cycle in advanced search.
KEYWORD_SEARCH_PLAN = [
    # Core services are mostly goods/service procurement.
    *[{"keyword": keyword, "proc_nature": "Goods", "weight": 1.35} for keyword in KEYWORD_GROUPS["core_services"]],
    # Fiber and physical rollout opportunities are works-focused.
    *[{"keyword": keyword, "proc_nature": "Works", "weight": 1.2} for keyword in KEYWORD_GROUPS["infrastructure_fiber"]],
    # Hardware-heavy leads in goods.
    *[{"keyword": keyword, "proc_nature": "Goods", "weight": 1.1} for keyword in KEYWORD_GROUPS["hardware_equipment"]],
    # Managed service opportunities may appear as service or works.
    *[{"keyword": keyword, "proc_nature": "Service", "weight": 1.0} for keyword in KEYWORD_GROUPS["managed_services"]],
    # Catch hidden typo tenders with lower confidence.
    *[{"keyword": keyword, "proc_nature": "Goods", "weight": 0.9} for keyword in KEYWORD_GROUPS["typo_variations"]],
]

DEFAULT_TIMEOUT_MS = 30000
DEFAULT_MAX_PAGES = 5
DEFAULT_API_BASE_URL = "http://127.0.0.1:8000"
DEFAULT_REFRESH_MINUTES = 30

# Only keep tenders around the current window and avoid old stale rows.
MAX_DEADLINE_WINDOW_DAYS = 30
MAX_ITEMS_PER_CYCLE = 10

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)

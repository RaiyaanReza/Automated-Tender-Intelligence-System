import os
from urllib.parse import quote_plus

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

# Fall back to local SQLite for development if DATABASE_URL is not configured.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./atis.db")


def _normalize_database_url(url: str) -> str:
	"""Encode passwords that contain reserved URL characters such as '@'."""
	if not url.startswith(("postgresql://", "postgres://")):
		return url

	if url.count("@") <= 1:
		return url

	scheme, rest = url.split("://", 1)
	credentials, host_part = rest.rsplit("@", 1)
	if ":" not in credentials:
		return url

	username, password = credentials.split(":", 1)
	encoded_password = quote_plus(password)
	return f"{scheme}://{username}:{encoded_password}@{host_part}"


def _ensure_sslmode(url: str) -> str:
	if not url.startswith(("postgresql://", "postgres://")):
		return url
	if "sslmode=" in url:
		return url
	separator = "&" if "?" in url else "?"
	return f"{url}{separator}sslmode=require"


def _make_engine(url: str):
	connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
	return create_engine(url, connect_args=connect_args)


def _db_identity(url: str):
	try:
		parsed = make_url(url)
		return parsed.get_backend_name(), parsed.host or "local"
	except Exception:
		return "unknown", "unknown"


DATABASE_URL = _normalize_database_url(DATABASE_URL)
DATABASE_URL = _ensure_sslmode(DATABASE_URL)
engine = _make_engine(DATABASE_URL)
ACTIVE_DB_DRIVER, ACTIVE_DB_HOST = _db_identity(DATABASE_URL)
DB_FALLBACK_USED = False
try:
	with engine.connect() as connection:
		connection.execute(text("SELECT 1"))
except Exception:
	fallback_url = "sqlite:///./atis.db"
	engine = _make_engine(fallback_url)
	ACTIVE_DB_DRIVER, ACTIVE_DB_HOST = _db_identity(fallback_url)
	DB_FALLBACK_USED = True

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db_status():
	return {
		"driver": ACTIVE_DB_DRIVER,
		"host": ACTIVE_DB_HOST,
		"fallback_used": DB_FALLBACK_USED,
	}


def get_db():
	db = SessionLocal()
	try:
		yield db
	finally:
		db.close()
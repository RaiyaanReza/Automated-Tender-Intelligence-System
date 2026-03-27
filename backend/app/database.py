"""
database.py

SQLAlchemy setup placeholder. Intended to configure DB engine and session
pointing to a cloud DB (e.g., Supabase/Postgres). Backend developer should
configure connection URL from environment variables (see ../.env).
"""

from sqlalchemy.orm import sessionmaker


# Placeholder engine/session creation
def get_session():
    """Return a DB session. Implement engine creation in real code."""
    raise NotImplementedError("get_session must be implemented by backend team")

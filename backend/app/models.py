from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, JSON, Index
from .database import Base
import uuid

class Tender(Base):
    __tablename__ = "tenders"
    __table_args__ = (
        Index("ix_tenders_priority_status", "priority", "status"),
        Index("ix_tenders_deadline", "deadline"),
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tender_id = Column(String, unique=True, index=True) # e-GP ID
    title = Column(String, nullable=False)
    organization = Column(String)
    deadline = Column(DateTime)
    value = Column(String, nullable=True)     # For showing on dashboard
    priority = Column(String, default="Low")  # AI calculated: High, Medium, Low
    status = Column(String, default="new")    # new, relevant, ignored, applied
    description = Column(Text, nullable=True) # Full scraped text
    ai_summary = Column(JSON, nullable=True)  # Store Gemini's structured output here


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    message = Column(String, nullable=False)
    level = Column(String, default="info")
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class AppSetting(Base):
    __tablename__ = "app_settings"

    key = Column(String, primary_key=True)
    value = Column(String, nullable=False)


class Source(Base):
    __tablename__ = "sources"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False, unique=True)
    source_type = Column(String, default="web-scraper", nullable=False)
    status = Column(String, default="active", nullable=False)
    records_detected = Column(Integer, default=0, nullable=False)
    last_sync = Column(DateTime, default=datetime.utcnow, nullable=False)


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tender_ref = Column(String, nullable=False)
    title = Column(String, nullable=False)
    size_kb = Column(Integer, default=0, nullable=False)
    status = Column(String, default="indexed", nullable=False)
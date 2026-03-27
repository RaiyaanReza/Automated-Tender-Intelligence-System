from typing import Optional
from datetime import datetime, timedelta

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy.orm import Session
from . import models, database
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Create tables in Postgres automatically
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI()

DEFAULT_SETTINGS = {
    "refresh_interval_minutes": "15",
    "min_priority": "Low",
    "email_notifications": "false",
    "telegram_notifications": "true",
}


def seed_demo_tenders_if_empty(db: Session):
    existing_egp = (
        db.query(models.Tender)
        .filter(models.Tender.tender_id.like("EGP-%"))
        .count()
    )
    if existing_egp >= 3:
        return

    now = datetime.utcnow()
    demo_rows = [
        models.Tender(
            tender_id="EGP-ICT-2026-0001",
            title="e-GP Network Infrastructure Upgrade",
            organization="Bangladesh e-GP Authority",
            deadline=now + timedelta(days=7),
            value="$2.5M",
            priority="High",
            status="new",
            description="Upgrade national backbone network across 6 regions through e-GP tendering.",
            ai_summary={"fit": "High", "notes": "Strong alignment with networking focus."},
        ),
        models.Tender(
            tender_id="EGP-CLOUD-2026-0002",
            title="Government Cloud Services Procurement",
            organization="National IT Authority",
            deadline=now + timedelta(days=14),
            value="$1.8M",
            priority="Medium",
            status="review",
            description="Managed cloud hosting and migration support services.",
            ai_summary={"fit": "Medium", "notes": "Good scope but tighter budget expectations."},
        ),
        models.Tender(
            tender_id="EGP-CYBER-2026-0003",
            title="National Cybersecurity Solutions",
            organization="Ministry of Defense",
            deadline=now + timedelta(days=5),
            value="$3.2M",
            priority="Urgent",
            status="urgent",
            description="SOC enhancement, SIEM modernization, and response automation.",
            ai_summary={"fit": "High", "notes": "Critical and time-sensitive scope."},
        ),
    ]

    existing_tender_ids = {
        row[0] for row in db.query(models.Tender.tender_id).all() if row[0]
    }
    rows_to_insert = [row for row in demo_rows if row.tender_id not in existing_tender_ids]
    if not rows_to_insert:
        return

    db.add_all(rows_to_insert)
    db.commit()


def seed_alerts_if_empty(db: Session):
    if db.query(models.Alert).count() > 0:
        return
    db.add(
        models.Alert(
            message="New high-priority tender detected",
            level="high",
            is_read=False,
            created_at=datetime.utcnow(),
        )
    )
    db.commit()


def seed_settings_if_empty(db: Session):
    existing_keys = {row[0] for row in db.query(models.AppSetting.key).all()}
    rows = []
    for key, value in DEFAULT_SETTINGS.items():
        if key not in existing_keys:
            rows.append(models.AppSetting(key=key, value=value))
    if rows:
        db.add_all(rows)
        db.commit()


def seed_sources_if_empty(db: Session):
    existing = db.query(models.Source).filter(models.Source.name == "Bangladesh e-GP Portal").first()
    if existing:
        return
    db.add(
        models.Source(
            name="Bangladesh e-GP Portal",
            source_type="web-scraper",
            status="active",
            records_detected=db.query(models.Tender).count(),
            last_sync=datetime.utcnow(),
        )
    )
    db.commit()


def sync_documents_from_tenders(db: Session):
    tenders = db.query(models.Tender).all()
    existing_refs = {row[0] for row in db.query(models.Document.tender_ref).all()}
    rows = []
    for index, tender in enumerate(tenders, start=1):
        if not tender.tender_id or tender.tender_id in existing_refs:
            continue
        rows.append(
            models.Document(
                tender_ref=tender.tender_id,
                title=f"{tender.title} - RFP.pdf",
                size_kb=240 + (index * 17),
                status="indexed",
            )
        )
    if rows:
        db.add_all(rows)
        db.commit()


def _upsert_setting(db: Session, key: str, value: str):
    row = db.query(models.AppSetting).filter(models.AppSetting.key == key).first()
    if row:
        row.value = value
        db.add(row)
    else:
        db.add(models.AppSetting(key=key, value=value))


def _to_bool(value: str) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _load_settings(db: Session):
    rows = db.query(models.AppSetting).all()
    kv = {row.key: row.value for row in rows}
    return {
        "refresh_interval_minutes": int(kv.get("refresh_interval_minutes", "15")),
        "min_priority": kv.get("min_priority", "Low"),
        "email_notifications": _to_bool(kv.get("email_notifications", "false")),
        "telegram_notifications": _to_bool(kv.get("telegram_notifications", "true")),
    }


@app.on_event("startup")
def app_startup():
    status = database.get_db_status()
    print(
        f"[DB] driver={status['driver']} host={status['host']} fallback={status['fallback_used']}"
    )
    db = database.SessionLocal()
    try:
        seed_demo_tenders_if_empty(db)
        seed_alerts_if_empty(db)
        seed_settings_if_empty(db)
        seed_sources_if_empty(db)
        sync_documents_from_tenders(db)
    finally:
        db.close()


class StatusUpdate(BaseModel):
    status: str


class SettingsPayload(BaseModel):
    refresh_interval_minutes: Optional[int] = 15
    min_priority: Optional[str] = "Low"
    email_notifications: Optional[bool] = False
    telegram_notifications: Optional[bool] = True


class TenderIn(BaseModel):
    tender_id: str
    title: str
    organization: Optional[str] = None
    deadline: Optional[datetime] = None
    value: Optional[str] = None
    priority: Optional[str] = "Low"
    status: Optional[str] = "PENDING_ANALYSIS"
    description: Optional[str] = None
    ai_summary: Optional[dict] = None


class TenderIngestPayload(BaseModel):
    items: list[TenderIn]

# Allow your React Frontend (Vite) to talk to this Backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1):517[0-9]$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/tenders")
def read_tenders(db: Session = Depends(database.get_db)):
    tenders = db.query(models.Tender).all()
    return tenders


@app.get("/")
def healthcheck():
    return {"status": "ok"}


@app.get("/health/db")
def db_health(db: Session = Depends(database.get_db)):
    status = database.get_db_status()
    return {
        "connected": True,
        "database": status,
        "tender_count": db.query(models.Tender).count(),
    }


@app.get("/dashboard/stats")
def dashboard_stats(db: Session = Depends(database.get_db)):
    tenders = db.query(models.Tender).all()
    total = len(tenders)
    relevant = len([t for t in tenders if t.priority in {"High", "Urgent"}])
    pending = len([t for t in tenders if t.status in {"new", "review"}])
    success_rate = f"{round((relevant / total) * 100)}%" if total > 0 else "0%"
    return {
        "total": total,
        "relevant": relevant,
        "pending": pending,
        "success_rate": success_rate,
    }


@app.post("/ingest/tenders")
def ingest_tenders(payload: TenderIngestPayload, db: Session = Depends(database.get_db)):
    inserted = 0
    updated = 0
    for item in payload.items:
        row = (
            db.query(models.Tender)
            .filter(models.Tender.tender_id == item.tender_id)
            .first()
        )
        if row:
            row.title = item.title
            row.organization = item.organization
            row.deadline = item.deadline
            row.value = item.value
            row.priority = item.priority or row.priority
            row.status = item.status or row.status
            row.description = item.description
            row.ai_summary = item.ai_summary
            db.add(row)
            updated += 1
        else:
            db.add(
                models.Tender(
                    tender_id=item.tender_id,
                    title=item.title,
                    organization=item.organization,
                    deadline=item.deadline,
                    value=item.value,
                    priority=item.priority or "Low",
                    status=item.status or "PENDING_ANALYSIS",
                    description=item.description,
                    ai_summary=item.ai_summary,
                )
            )
            inserted += 1
    db.commit()
    sync_documents_from_tenders(db)
    return {"inserted": inserted, "updated": updated, "received": len(payload.items)}


@app.get("/tenders/{tender_id}")
def get_tender(tender_id: str, db: Session = Depends(database.get_db)):
    tender = db.query(models.Tender).filter(models.Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    return tender

@app.get("/tenders/{tender_id}/summary")
def get_summary(tender_id: str, db: Session = Depends(database.get_db)):
    tender = db.query(models.Tender).filter(models.Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    return tender.ai_summary


@app.patch("/tenders/{tender_id}/status")
def update_status(tender_id: str, body: StatusUpdate, db: Session = Depends(database.get_db)):
    tender = db.query(models.Tender).filter(models.Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    tender.status = body.status
    db.add(tender)
    db.commit()
    db.refresh(tender)
    return tender


@app.get("/alerts")
def get_alerts(db: Session = Depends(database.get_db)):
    rows = db.query(models.Alert).order_by(models.Alert.created_at.desc()).all()
    return [
        {
            "id": item.id,
            "message": item.message,
            "level": item.level,
            "read": item.is_read,
            "created_at": item.created_at.isoformat(),
        }
        for item in rows
    ]


@app.patch("/alerts/{alert_id}/read")
def mark_alert_read(alert_id: str, db: Session = Depends(database.get_db)):
    item = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Alert not found")
    item.is_read = True
    db.add(item)
    db.commit()
    db.refresh(item)
    return {
        "id": item.id,
        "message": item.message,
        "level": item.level,
        "read": item.is_read,
        "created_at": item.created_at.isoformat(),
    }


@app.get("/settings")
def get_settings(db: Session = Depends(database.get_db)):
    return _load_settings(db)


@app.put("/settings")
def update_settings(payload: SettingsPayload, db: Session = Depends(database.get_db)):
    values = payload.model_dump(exclude_none=True)
    for key, value in values.items():
        _upsert_setting(db, key, str(value).lower() if isinstance(value, bool) else str(value))
    db.commit()
    return _load_settings(db)


@app.get("/analysis")
def get_analysis(db: Session = Depends(database.get_db)):
    tenders = db.query(models.Tender).all()
    results = []
    for tender in tenders:
        ai_summary = tender.ai_summary if isinstance(tender.ai_summary, dict) else {}
        results.append(
            {
                "tender_id": tender.id,
                "title": tender.title,
                "priority": tender.priority,
                "fit": ai_summary.get("fit", "Unknown"),
                "notes": ai_summary.get("notes", "No analysis available"),
            }
        )
    return results


@app.get("/sources")
def get_sources(db: Session = Depends(database.get_db)):
    rows = db.query(models.Source).order_by(models.Source.name.asc()).all()
    tender_count = db.query(models.Tender).count()
    response = []
    for item in rows:
        item.records_detected = tender_count
        item.last_sync = datetime.utcnow()
        db.add(item)
        response.append(
            {
                "id": item.id,
                "name": item.name,
                "type": item.source_type,
                "status": item.status,
                "records_detected": item.records_detected,
                "last_sync": item.last_sync.isoformat(),
            }
        )
    db.commit()
    return response


@app.get("/documents")
def get_documents(db: Session = Depends(database.get_db)):
    sync_documents_from_tenders(db)
    rows = db.query(models.Document).order_by(models.Document.title.asc()).all()
    return [
        {
            "id": item.id,
            "tender_id": item.tender_ref,
            "title": item.title,
            "size_kb": item.size_kb,
            "status": item.status,
        }
        for item in rows
    ]
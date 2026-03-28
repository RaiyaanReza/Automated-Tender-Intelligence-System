from typing import Optional
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse
from threading import Event, Lock, Thread
import uuid

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import case, func, or_
from . import models, database
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
import httpx
from pydantic import BaseModel
from .scraper.main_scraper import ScraperConfig, run_scraper
from .scraper.notifier import send_telegram_alert

# Create tables in Postgres automatically
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI()

SCRAPER_LOCK = Lock()
SCRAPER_THREAD: Optional[Thread] = None
SCRAPER_STOP_EVENT: Optional[Event] = None
SCRAPER_STATE = {
    "running": False,
    "stop_requested": False,
    "job_id": None,
    "started_at": None,
    "finished_at": None,
    "last_result": None,
    "last_error": None,
    "params": {},
}

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


def remove_demo_tenders(db: Session):
    # Drop non-production seed rows so UI remains fully data-driven from scraper ingestion.
    deleted = (
        db.query(models.Tender)
        .filter(
            or_(
                models.Tender.tender_id.like("EGP-%"),
                models.Tender.tender_id.like("ATIS-%"),
            )
        )
        .delete(synchronize_session=False)
    )
    if deleted <= 0:
        return
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
    # Rebuild documents table from local or remote PDF paths.
    db.query(models.Document).delete()
    db.commit()

    tenders = db.query(models.Tender).all()
    rows = []
    for tender in tenders:
        if not tender.tender_id:
            continue
        ai = tender.ai_summary if isinstance(tender.ai_summary, dict) else {}
        pdf_path = str(ai.get("pdf_saved_path", "")).strip()
        remote_pdf_url = _resolve_remote_pdf_url(ai)

        title = ""
        size_kb = 0
        status = "downloadable"

        path_obj = Path(pdf_path) if pdf_path else None
        if path_obj and path_obj.exists() and path_obj.suffix.lower() == ".pdf":
            title = path_obj.name
            size_kb = max(1, int(path_obj.stat().st_size / 1024))
            status = "downloadable"
        elif remote_pdf_url:
            title = Path(urlparse(remote_pdf_url).path).name or f"{tender.tender_id}.pdf"
            if not title.lower().endswith(".pdf"):
                title = f"{title}.pdf"
            size_kb = 0
            status = "downloadable-remote"
        else:
            continue

        rows.append(
            models.Document(
                tender_ref=tender.tender_id,
                title=title,
                size_kb=size_kb,
                status=status,
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


def _normalized_ref_candidates(reference: str) -> list[str]:
    raw = str(reference or "").strip()
    if not raw:
        return []

    candidates = [raw]
    decoded = unquote(raw).strip()
    if decoded and decoded not in candidates:
        candidates.append(decoded)
    return candidates


def _resolve_tender_by_reference(db: Session, reference: str):
    candidates = _normalized_ref_candidates(reference)
    if not candidates:
        return None

    for candidate in candidates:
        row = db.query(models.Tender).filter(models.Tender.tender_id == candidate).first()
        if row:
            return row

    for candidate in candidates:
        row = db.query(models.Tender).filter(models.Tender.id == candidate).first()
        if row:
            return row

    lowered = [candidate.lower() for candidate in candidates if candidate]
    if lowered:
        row = (
            db.query(models.Tender)
            .filter(models.Tender.tender_id.is_not(None))
            .filter(func.lower(models.Tender.tender_id).in_(lowered))
            .first()
        )
        if row:
            return row

    return None


def _resolve_remote_pdf_url(ai_summary: dict) -> str:
    if not isinstance(ai_summary, dict):
        return ""

    raw_pdf = str(ai_summary.get("save_as_pdf_url", "")).strip()
    if not raw_pdf:
        return ""

    if raw_pdf.startswith(("http://", "https://")):
        return raw_pdf

    base = (
        str(ai_summary.get("source_url", "")).strip()
        or str(ai_summary.get("detail_url", "")).strip()
        or "https://www.eprocure.gov.bd/resources/common/"
    )
    try:
        return urljoin(base, raw_pdf)
    except Exception:
        return ""


def _build_scraper_config(payload: "ScraperRunPayload", stop_checker=None) -> ScraperConfig:
    keywords = []
    for keyword in payload.keywords or []:
        clean = str(keyword or "").strip()
        if clean and clean not in keywords:
            keywords.append(clean)

    return ScraperConfig(
        keyword=payload.keyword or "",
        keywords=keywords or None,
        proc_nature=payload.proc_nature or "",
        publish_from=payload.publish_from or "01-Feb-2026",
        publish_to=payload.publish_to or "",
        max_pages=payload.max_pages or 1,
        max_items_per_cycle=payload.max_items_per_cycle or 10,
        max_deadline_window_days=max(1, min(int(payload.max_deadline_window_days or 30), 120)),
        save_pdf=bool(payload.save_pdf),
        headless=True,
        stop_requested=stop_checker,
    )


def _snapshot_scraper_state():
    with SCRAPER_LOCK:
        return {
            "running": bool(SCRAPER_STATE["running"]),
            "stop_requested": bool(SCRAPER_STATE["stop_requested"]),
            "job_id": SCRAPER_STATE["job_id"],
            "started_at": SCRAPER_STATE["started_at"],
            "finished_at": SCRAPER_STATE["finished_at"],
            "last_result": SCRAPER_STATE["last_result"],
            "last_error": SCRAPER_STATE["last_error"],
            "params": SCRAPER_STATE["params"],
        }


def _run_scraper_job(payload: "ScraperRunPayload", job_id: str):
    global SCRAPER_THREAD, SCRAPER_STOP_EVENT

    stop_event = SCRAPER_STOP_EVENT
    result = None
    error_message = None
    try:
        config = _build_scraper_config(payload, stop_checker=(lambda: bool(stop_event and stop_event.is_set())))
        result = run_scraper(config)
    except Exception as exc:
        error_message = str(exc)
        result = {"status": "failed", "error": error_message}
    finally:
        with SCRAPER_LOCK:
            SCRAPER_STATE["running"] = False
            SCRAPER_STATE["finished_at"] = datetime.utcnow().isoformat()
            SCRAPER_STATE["last_result"] = result
            SCRAPER_STATE["last_error"] = error_message
            SCRAPER_THREAD = None
            SCRAPER_STOP_EVENT = None


@app.on_event("startup")
def app_startup():
    status = database.get_db_status()
    print(
        f"[DB] driver={status['driver']} host={status['host']} fallback={status['fallback_used']}"
    )
    db = database.SessionLocal()
    try:
        remove_demo_tenders(db)
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


class ScraperRunPayload(BaseModel):
    keyword: Optional[str] = None
    keywords: Optional[list[str]] = None
    proc_nature: Optional[str] = None
    publish_from: Optional[str] = "01-Feb-2026"
    publish_to: Optional[str] = None
    max_pages: Optional[int] = 1
    max_items_per_cycle: Optional[int] = 10
    save_pdf: Optional[bool] = True
    max_deadline_window_days: Optional[int] = 30


class PrunePayload(BaseModel):
    keep_from: Optional[datetime] = None
    keyword_only: Optional[bool] = True


class AlertTestPayload(BaseModel):
    tender_id: Optional[str] = None

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
def read_tenders(
    limit: Optional[int] = None,
    offset: int = 0,
    sort_by: str = "deadline",
    order: str = "desc",
    db: Session = Depends(database.get_db),
):
    query = db.query(models.Tender)

    sort_key = str(sort_by or "deadline").strip().lower()
    direction = str(order or "desc").strip().lower()
    reverse = direction == "desc"

    if sort_key == "title":
        query = query.order_by(models.Tender.title.desc() if reverse else models.Tender.title.asc())
    elif sort_key == "priority":
        priority_rank = case(
            (models.Tender.priority == "Urgent", 4),
            (models.Tender.priority == "High", 3),
            (models.Tender.priority == "Medium", 2),
            else_=1,
        )
        query = query.order_by(priority_rank.desc() if reverse else priority_rank.asc(), models.Tender.deadline.asc())
    else:
        query = query.order_by(
            models.Tender.deadline.is_(None),
            models.Tender.deadline.desc() if reverse else models.Tender.deadline.asc(),
            models.Tender.title.asc(),
        )

    safe_offset = max(0, offset)
    if safe_offset:
        query = query.offset(safe_offset)

    if limit is not None:
        safe_limit = max(1, min(limit, 2000))
        query = query.limit(safe_limit)

    return query.all()


@app.post("/scraper/run")
def run_scraper_now(payload: ScraperRunPayload, db: Session = Depends(database.get_db)):
    with SCRAPER_LOCK:
        if SCRAPER_STATE["running"]:
            raise HTTPException(status_code=409, detail="Scraper is already running")

    config = _build_scraper_config(payload)
    result = run_scraper(config)
    return result


@app.post("/scraper/start")
def start_scraper(payload: ScraperRunPayload):
    global SCRAPER_THREAD, SCRAPER_STOP_EVENT

    with SCRAPER_LOCK:
        if SCRAPER_STATE["running"]:
            raise HTTPException(status_code=409, detail="Scraper is already running")

        job_id = str(uuid.uuid4())
        SCRAPER_STOP_EVENT = Event()
        SCRAPER_STATE["running"] = True
        SCRAPER_STATE["stop_requested"] = False
        SCRAPER_STATE["job_id"] = job_id
        SCRAPER_STATE["started_at"] = datetime.utcnow().isoformat()
        SCRAPER_STATE["finished_at"] = None
        SCRAPER_STATE["last_error"] = None
        SCRAPER_STATE["params"] = payload.model_dump(exclude_none=True)

        SCRAPER_THREAD = Thread(target=_run_scraper_job, args=(payload, job_id), daemon=True)
        SCRAPER_THREAD.start()

    return _snapshot_scraper_state()


@app.post("/scraper/stop")
def stop_scraper():
    idle = False
    with SCRAPER_LOCK:
        if not SCRAPER_STATE["running"]:
            idle = True
        else:
            SCRAPER_STATE["stop_requested"] = True
            if SCRAPER_STOP_EVENT:
                SCRAPER_STOP_EVENT.set()

    if idle:
        return {"status": "idle", **_snapshot_scraper_state()}

    return {"status": "stopping", **_snapshot_scraper_state()}


@app.get("/scraper/status")
def scraper_status():
    return _snapshot_scraper_state()


@app.post("/tenders/prune")
def prune_tenders(payload: PrunePayload, db: Session = Depends(database.get_db)):
    keep_from = payload.keep_from or datetime(2026, 2, 1)

    query = db.query(models.Tender).filter(
        or_(models.Tender.deadline.is_(None), models.Tender.deadline < keep_from)
    )

    rows = query.all()
    removed = 0
    for row in rows:
        if payload.keyword_only:
            ai = row.ai_summary if isinstance(row.ai_summary, dict) else {}
            if ai.get("keyword"):
                continue
        db.delete(row)
        removed += 1
    db.commit()
    return {"removed": removed, "keep_from": keep_from.isoformat()}


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
    total = db.query(func.count(models.Tender.id)).scalar() or 0
    relevant = (
        db.query(func.count(models.Tender.id))
        .filter(models.Tender.priority.in_(["High", "Urgent"]))
        .scalar()
        or 0
    )
    pending = (
        db.query(func.count(models.Tender.id))
        .filter(models.Tender.status.in_(["new", "review", "PENDING_ANALYSIS"]))
        .scalar()
        or 0
    )
    success_rate = f"{round((relevant / total) * 100)}%" if total > 0 else "0%"
    return {
        "total": total,
        "relevant": relevant,
        "pending": pending,
        "success_rate": success_rate,
    }


@app.get("/dashboard/sidebar-counts")
def dashboard_sidebar_counts(db: Session = Depends(database.get_db)):
    return {
        "tenders": db.query(models.Tender).count(),
        "alerts": db.query(models.Alert).filter(models.Alert.is_read.is_(False)).count(),
        "documents": db.query(models.Document).count(),
        "sources": db.query(models.Source).count(),
    }


@app.post("/ingest/tenders")
def ingest_tenders(payload: TenderIngestPayload, db: Session = Depends(database.get_db)):
    unique_items = {}
    for item in payload.items:
        key = str(item.tender_id or "").strip()
        if not key:
            continue
        unique_items[key] = item

    inserted = 0
    updated = 0
    for item in unique_items.values():
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
    return {"inserted": inserted, "updated": updated, "received": len(unique_items)}


@app.get("/tenders/resolve")
def resolve_tender(ref: str, db: Session = Depends(database.get_db)):
    tender = _resolve_tender_by_reference(db, ref)
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    return tender


@app.get("/tenders/{tender_id}")
def get_tender(tender_id: str, db: Session = Depends(database.get_db)):
    tender = _resolve_tender_by_reference(db, tender_id)
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    return tender

@app.get("/tenders/{tender_id}/summary")
def get_summary(tender_id: str, db: Session = Depends(database.get_db)):
    tender = _resolve_tender_by_reference(db, tender_id)
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    return tender.ai_summary


@app.patch("/tenders/{tender_id}/status")
def update_status(tender_id: str, body: StatusUpdate, db: Session = Depends(database.get_db)):
    tender = _resolve_tender_by_reference(db, tender_id)
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


@app.post("/alerts/test")
def send_test_alert(payload: AlertTestPayload, db: Session = Depends(database.get_db)):
    row = None
    if payload.tender_id:
        row = db.query(models.Tender).filter(models.Tender.tender_id == payload.tender_id).first()

    if not row:
        candidates = db.query(models.Tender).all()
        for candidate in candidates:
            ai = candidate.ai_summary if isinstance(candidate.ai_summary, dict) else {}
            if ai.get("keyword") and ai.get("source_url"):
                row = candidate
                break

    if not row:
        return {"status": "skipped", "reason": "No matched tender with source URL found"}

    item = {
        "tender_id": row.tender_id,
        "title": row.title,
        "priority": row.priority,
        "description": row.description,
        "ai_summary": row.ai_summary if isinstance(row.ai_summary, dict) else {},
    }
    return send_telegram_alert([item])


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
                "tender_id": tender.tender_id or tender.id,
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
        response.append(
            {
                "id": item.id,
                "name": item.name,
                "type": item.source_type,
                "status": item.status,
                "records_detected": tender_count,
                "last_sync": item.last_sync.isoformat() if item.last_sync else datetime.utcnow().isoformat(),
            }
        )
    return response


@app.get("/documents")
def get_documents(db: Session = Depends(database.get_db)):
    rows = db.query(models.Document).order_by(models.Document.title.asc()).all()
    return [
        {
            "id": item.id,
            "tender_id": item.tender_ref,
            "title": item.title,
            "size_kb": item.size_kb,
            "status": item.status,
            "download_url": f"/documents/{item.tender_ref}/download",
        }
        for item in rows
    ]


@app.get("/documents/{tender_ref}/download")
def download_document(tender_ref: str, db: Session = Depends(database.get_db)):
    tender = db.query(models.Tender).filter(models.Tender.tender_id == tender_ref).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    ai = tender.ai_summary if isinstance(tender.ai_summary, dict) else {}
    pdf_path = str(ai.get("pdf_saved_path", "")).strip()
    if pdf_path:
        file_path = Path(pdf_path)
        if file_path.exists() and file_path.suffix.lower() == ".pdf":
            return FileResponse(
                path=str(file_path),
                media_type="application/pdf",
                filename=file_path.name,
            )

    remote_pdf_url = _resolve_remote_pdf_url(ai)
    if not remote_pdf_url:
        raise HTTPException(status_code=404, detail="Document not available")

    try:
        with httpx.Client(timeout=40.0, verify=False, follow_redirects=True) as client:
            response = client.get(remote_pdf_url)
            response.raise_for_status()
            data = response.content or b""
            content_type = str(response.headers.get("content-type", "")).lower()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch remote document: {exc}")

    if not data or ("application/pdf" not in content_type and not data.startswith(b"%PDF")):
        raise HTTPException(status_code=502, detail="Remote document is not a valid PDF")

    filename = Path(urlparse(remote_pdf_url).path).name or f"{tender_ref}.pdf"
    if not filename.lower().endswith(".pdf"):
        filename = f"{filename}.pdf"

    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
import io
import os
from pathlib import Path

from fastapi import APIRouter, Depends, File, Query, UploadFile
from pypdf import PdfReader
from sqlalchemy import delete, select

from app.db.models import Document as DocumentModel
from app.dependencies.auth import require_admin
from app.dependencies.db import DB
from app.schemas.document import DocumentOut, DocumentsUpdate
from core.exceptions.base import ValidationError
from core.logging.setup import get_logger

log = get_logger(__name__)
router = APIRouter()


def _resolve_resume_dir() -> Path:
    """Stopgap only (see docs/ARCHITECTURE.md's Content model section): writes
    into the same data/resume/ the frontend's /resume route reads from, which
    only works where the two share a filesystem — a bare `uv run` checkout, not
    the deployed api container.

    Dockerfile.api COPYs only services/api/app into the image as /app/app, with
    nothing above it — no services/, no repo root. A hardcoded parents[N]
    index that assumes the full monorepo depth is a real outage waiting to
    happen: it raised IndexError at *import time* in production, taking down
    the entire api service (every route, not just this one) since this ran the
    moment this module loaded. RESUME_UPLOAD_DIR sidesteps that; without it,
    fall back to somewhere on the container's own filesystem that always
    exists rather than crash the whole service over an admin-only feature
    that's already a documented stopgap in that environment.
    """
    override = os.environ.get("RESUME_UPLOAD_DIR")
    if override:
        return Path(override)
    parents = Path(__file__).resolve().parents
    if len(parents) > 5:
        return parents[5] / "data" / "resume"
    return Path("/tmp/resume-uploads")


RESUME_DIR = _resolve_resume_dir()
RESUME_FILENAME = "Varikuppala-Ravinder-Senior-AI-Platform-Engineer.pdf"


def _extract_pdf_text(data: bytes) -> str:
    reader = PdfReader(io.BytesIO(data))
    pages = (page.extract_text() or "" for page in reader.pages)
    return "\n\n".join(page.strip() for page in pages if page.strip())


def _to_out(d: DocumentModel) -> DocumentOut:
    return DocumentOut(
        id=d.id,
        doc_type=d.doc_type,
        title=d.title,
        body=d.body,
        asset_url=d.asset_url,
        display_order=d.display_order,
    )


@router.get("/documents", response_model=list[DocumentOut])
async def list_documents(db: DB, doc_type: str | None = Query(default=None)) -> list[DocumentOut]:
    stmt = select(DocumentModel).order_by(DocumentModel.doc_type, DocumentModel.display_order)
    if doc_type:
        stmt = stmt.where(DocumentModel.doc_type == doc_type)
    rows = await db.scalars(stmt)
    return [_to_out(d) for d in rows]


@router.put(
    "/documents/{doc_type}",
    response_model=list[DocumentOut],
    dependencies=[Depends(require_admin)],
)
async def update_documents(doc_type: str, body: DocumentsUpdate, db: DB) -> list[DocumentOut]:
    """Replaces only the rows for `doc_type` — editing blogs never touches the
    resume row or certificates, unlike a flat whole-table replace."""
    await db.execute(delete(DocumentModel).where(DocumentModel.doc_type == doc_type))
    for d in body.documents:
        db.add(DocumentModel(doc_type=doc_type, **d.model_dump()))
    await db.flush()
    log.info("documents.updated", doc_type=doc_type, count=len(body.documents))
    rows = await db.scalars(
        select(DocumentModel).where(DocumentModel.doc_type == doc_type).order_by(DocumentModel.display_order)
    )
    return [_to_out(d) for d in rows]


@router.post(
    "/documents/resume/upload",
    response_model=DocumentOut,
    dependencies=[Depends(require_admin)],
)
async def upload_resume(db: DB, file: UploadFile = File(...)) -> DocumentOut:
    """Stopgap resume replace flow (see RESUME_DIR comment above): saves the
    uploaded PDF to data/resume/, extracts its text, and upserts the single
    `documents` row with doc_type='resume' so the next `make ingest` picks up
    the new content — same row shape the migration seeded, just repeatable."""
    if file.content_type != "application/pdf":
        raise ValidationError(message="Only application/pdf uploads are accepted")

    data = await file.read()
    if not data:
        raise ValidationError(message="Uploaded file is empty")

    body = _extract_pdf_text(data)
    if not body:
        raise ValidationError(message="Could not extract any text from the uploaded PDF")

    RESUME_DIR.mkdir(parents=True, exist_ok=True)
    (RESUME_DIR / RESUME_FILENAME).write_bytes(data)

    existing = await db.scalar(select(DocumentModel).where(DocumentModel.doc_type == "resume"))
    if existing is not None:
        existing.body = body
        existing.asset_url = "/resume"
        row = existing
    else:
        row = DocumentModel(doc_type="resume", title="Resume", body=body, asset_url="/resume", display_order=0)
        db.add(row)

    await db.flush()
    log.info("documents.resume_uploaded", size_bytes=len(data))
    return _to_out(row)

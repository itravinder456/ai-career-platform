import io
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

# services/api/app/api/v1/documents.py -> parents[5] is the repo root. Stopgap
# only: writes into the same data/resume/ the frontend's /resume route reads
# from (see that route's own comment) — works as-is in local dev where every
# service shares one checkout, but api and frontend are separate Docker images
# in production with no shared volume for data/, so this write is invisible to
# the deployed frontend container until that's addressed (shared volume, or
# serve the file from this service instead).
RESUME_DIR = Path(__file__).resolve().parents[5] / "data" / "resume"
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

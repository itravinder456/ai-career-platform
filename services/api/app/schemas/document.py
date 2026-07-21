from pydantic import Field

from core.models.base import AppModel


class DocumentOut(AppModel):
    id: int
    doc_type: str
    title: str
    body: str
    asset_url: str | None
    display_order: int


class DocumentIn(AppModel):
    title: str = Field(..., min_length=1, max_length=300)
    body: str = Field(..., min_length=1)
    asset_url: str | None = None
    display_order: int = 0


class DocumentsUpdate(AppModel):
    """Scoped by doc_type at the router level (PUT /documents/{doc_type}) — a
    flat whole-table replace would let editing one blog post also wipe the
    resume row and every certificate in the same call."""

    documents: list[DocumentIn]

import hashlib
import uuid

from core.models.base import AppModel

from app.loader import Document

CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
SEPARATORS = ("\n\n", "\n", ". ")


class Chunk(AppModel):
    id: str
    text: str
    source_path: str
    doc_type: str
    title: str


def _chunk_id(text: str) -> str:
    # Deterministic UUID from content hash: Qdrant point IDs must be an
    # unsigned int or a UUID, not an arbitrary string, so a raw sha256 hex
    # digest won't do. Deriving the UUID from the hash keeps re-ingesting
    # identical content idempotent (same text -> same point -> overwrite).
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    return str(uuid.UUID(bytes=digest[:16]))


def _split(text: str, chunk_size: int, separators: tuple[str, ...]) -> list[str]:
    """Recursively splits `text` down to pieces no larger than chunk_size, trying
    each separator in order and re-splitting any still-oversized piece with the
    next (finer) separator — not just the first one that produces >1 piece."""
    if len(text) <= chunk_size or not separators:
        return [text]

    separator, *rest = separators
    parts = [p.strip() for p in text.split(separator) if p.strip()]

    if len(parts) <= 1:
        return _split(text, chunk_size, tuple(rest))

    pieces: list[str] = []
    for part in parts:
        pieces.extend(_split(part, chunk_size, tuple(rest)))
    return pieces


def chunk_text(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
    separators: tuple[str, ...] = SEPARATORS,
) -> list[str]:
    """Semantic chunking: merge separator-delimited pieces up to chunk_size,
    carrying `overlap` characters of trailing context into the next chunk so
    a fact split across a boundary isn't lost from either chunk."""
    pieces = _split(text.strip(), chunk_size, separators)

    chunks: list[str] = []
    current = ""

    for piece in pieces:
        candidate = f"{current} {piece}".strip() if current else piece

        if len(candidate) <= chunk_size:
            current = candidate
            continue

        if current:
            chunks.append(current)
            current = f"{current[-overlap:]} {piece}".strip() if overlap else piece
        else:
            # Single piece already exceeds chunk_size — keep it whole rather
            # than cutting mid-word; RAG chunks favor completeness over strict sizing.
            chunks.append(piece)
            current = ""

    if current:
        chunks.append(current)

    return chunks


def chunk_documents(documents: list[Document]) -> tuple[list[Chunk], int]:
    """Returns (deduplicated chunks, total chunks generated before dedup)."""
    seen: set[str] = set()
    chunks: list[Chunk] = []
    total_generated = 0

    for document in documents:
        for text in chunk_text(document.text):
            total_generated += 1
            chunk_id = _chunk_id(text)
            if chunk_id in seen:
                continue
            seen.add(chunk_id)
            chunks.append(
                Chunk(
                    id=chunk_id,
                    text=text,
                    source_path=document.source_path,
                    doc_type=document.doc_type,
                    title=document.title,
                )
            )

    return chunks, total_generated

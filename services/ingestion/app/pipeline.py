from core.embeddings import embed_texts
from core.models.base import AppModel

from app.chunker import chunk_documents
from app.loader import load_documents
from app.store import ensure_collection, upsert_chunks


class IngestionResult(AppModel):
    files_loaded: int
    chunks_generated: int
    chunks_deduplicated: int
    chunks_upserted: int


async def run_ingestion() -> IngestionResult:
    documents = load_documents()
    chunks, total_generated = chunk_documents(documents)

    await ensure_collection()
    embeddings = await embed_texts([c.text for c in chunks])
    upserted = await upsert_chunks(chunks, embeddings)

    return IngestionResult(
        files_loaded=len(documents),
        chunks_generated=total_generated,
        chunks_deduplicated=total_generated - len(chunks),
        chunks_upserted=upserted,
    )

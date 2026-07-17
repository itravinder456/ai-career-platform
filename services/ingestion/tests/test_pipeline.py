from unittest.mock import AsyncMock

from app import pipeline
from app.loader import Document


async def test_run_ingestion_wires_load_chunk_embed_upsert(monkeypatch):
    duplicate_text = "Ravinder is a Senior AI Platform Engineer."
    documents = [
        Document(text=duplicate_text, source_path="resume/a.md", doc_type="resume", title="A"),
        Document(text=duplicate_text, source_path="resume/b.md", doc_type="resume", title="B"),
        Document(text="Unique project text.", source_path="projects/x.md", doc_type="projects", title="X"),
    ]
    monkeypatch.setattr(pipeline, "load_documents", lambda: documents)

    ensure_collection = AsyncMock()
    monkeypatch.setattr(pipeline, "ensure_collection", ensure_collection)

    embed_texts = AsyncMock(side_effect=lambda texts: [[0.1, 0.2, 0.3] for _ in texts])
    monkeypatch.setattr(pipeline, "embed_texts", embed_texts)

    upsert_chunks = AsyncMock(return_value=2)
    monkeypatch.setattr(pipeline, "upsert_chunks", upsert_chunks)

    result = await pipeline.run_ingestion()

    ensure_collection.assert_awaited_once()

    # 3 documents generated, 2 identical -> 2 unique chunks fed downstream
    assert result.files_loaded == 3
    assert result.chunks_generated == 3
    assert result.chunks_deduplicated == 1
    assert result.chunks_upserted == 2

    embedded_texts = embed_texts.await_args.args[0]
    assert len(embedded_texts) == 2

    upserted_chunks, upserted_embeddings = upsert_chunks.await_args.args
    assert len(upserted_chunks) == 2
    assert len(upserted_embeddings) == 2


async def test_run_ingestion_handles_no_documents(monkeypatch):
    monkeypatch.setattr(pipeline, "load_documents", lambda: [])

    ensure_collection = AsyncMock()
    monkeypatch.setattr(pipeline, "ensure_collection", ensure_collection)

    embed_texts = AsyncMock(return_value=[])
    monkeypatch.setattr(pipeline, "embed_texts", embed_texts)

    upsert_chunks = AsyncMock(return_value=0)
    monkeypatch.setattr(pipeline, "upsert_chunks", upsert_chunks)

    result = await pipeline.run_ingestion()

    assert result.files_loaded == 0
    assert result.chunks_generated == 0
    assert result.chunks_upserted == 0

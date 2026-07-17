from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

from core.config import get_settings

from app.chunker import Chunk

_client: AsyncQdrantClient | None = None


def get_qdrant_client() -> AsyncQdrantClient:
    global _client
    if _client is None:
        s = get_settings()
        api_key = s.qdrant_api_key.get_secret_value() if s.qdrant_api_key else None
        _client = AsyncQdrantClient(url=s.qdrant_url, api_key=api_key)
    return _client


async def close_qdrant() -> None:
    global _client
    if _client is not None:
        await _client.close()
        _client = None


async def ensure_collection() -> None:
    client = get_qdrant_client()
    s = get_settings()
    exists = await client.collection_exists(s.qdrant_collection)
    if not exists:
        await client.create_collection(
            collection_name=s.qdrant_collection,
            vectors_config=VectorParams(
                size=s.qdrant_vector_size,
                distance=Distance.COSINE,
            ),
        )


async def upsert_chunks(chunks: list[Chunk], embeddings: list[list[float]]) -> int:
    if not chunks:
        return 0

    client = get_qdrant_client()
    s = get_settings()

    points = [
        PointStruct(
            id=chunk.id,
            vector=embedding,
            payload={
                "text": chunk.text,
                "source": chunk.source_path,
                "doc_type": chunk.doc_type,
                "title": chunk.title,
            },
        )
        for chunk, embedding in zip(chunks, embeddings, strict=True)
    ]

    await client.upsert(collection_name=s.qdrant_collection, points=points)
    return len(points)

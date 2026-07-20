"""
RAG retrieval tool — searches the Qdrant collection populated by services/ingestion.

Bound into the career graph's TOOLS list (app/graphs/career.py) so the LLM can call it
mid-response when it needs a specific fact beyond the static profile summary already in
the system prompt. Degrades gracefully (returns a plain string, never raises) so a
Qdrant/OpenAI hiccup doesn't crash the chat turn — same non-fatal-if-infra-down spirit as
services/api's lifespan checks.
"""

import hashlib

from langchain_core.tools import tool
from qdrant_client import AsyncQdrantClient

from app.core.cache import cache_get, cache_set
from core.config import get_settings
from core.embeddings import embed_query
from core.logging.setup import get_logger

log = get_logger(__name__)

RESULT_LIMIT = 4
CACHE_TTL_SECONDS = 24 * 60 * 60  # 24h — see docs/ARCHITECTURE.md's Caching section

_qdrant: AsyncQdrantClient | None = None


def get_qdrant_client() -> AsyncQdrantClient:
    global _qdrant
    if _qdrant is None:
        s = get_settings()
        api_key = s.qdrant_api_key.get_secret_value() if s.qdrant_api_key else None
        _qdrant = AsyncQdrantClient(url=s.qdrant_url, api_key=api_key)
    return _qdrant


async def close_qdrant() -> None:
    global _qdrant
    if _qdrant is not None:
        await _qdrant.close()
        _qdrant = None


def _cache_key(collection: str, query: str) -> str:
    normalized = " ".join(query.lower().split())
    digest = hashlib.sha256(normalized.encode()).hexdigest()[:32]
    return f"rag:{collection}:{digest}"


async def retrieve_context(query: str, limit: int = RESULT_LIMIT) -> str:
    """Core retrieval logic — called directly for mandatory context injection (career-
    related graph nodes) and wrapped as a tool below for the LLM's own follow-up calls.

    Cached by normalized query text (see docs/ARCHITECTURE.md's Caching section) — RAG
    results for the same
    question are deterministic and don't depend on conversation history, so this is safe
    to cache aggressively. Only successful lookups are cached; a transient Qdrant/
    embedding failure is never cached, so it can't get "stuck" serving a false
    "unavailable" message after the underlying issue clears."""
    settings = get_settings()
    cache_key = _cache_key(settings.qdrant_collection, query)

    cached = await cache_get(cache_key)
    if cached is not None:
        log.info("cache.hit", key=cache_key)
        return cached
    log.info("cache.miss", key=cache_key)

    try:
        embedding = await embed_query(query)
        response = await get_qdrant_client().query_points(
            collection_name=settings.qdrant_collection,
            query=embedding,
            limit=limit,
        )
    except Exception as exc:
        log.warning("retrieval.unavailable", query=query, error=str(exc))
        return "The knowledge base is temporarily unavailable."

    if not response.points:
        result = "No relevant information found in the knowledge base."
    else:
        result = "\n\n".join(f"[{p.payload['source']}] {p.payload['text']}" for p in response.points)

    await cache_set(cache_key, result, CACHE_TTL_SECONDS)
    log.info("cache.set", key=cache_key, ttl_seconds=CACHE_TTL_SECONDS)
    return result


@tool
async def search_knowledge_base(query: str) -> str:
    """Search Ravinder's indexed knowledge base (resume, projects, blogs) for specific
    facts, metrics, or details not already covered in the system prompt. Use this when
    you need precise information beyond the general profile summary."""
    return await retrieve_context(query)

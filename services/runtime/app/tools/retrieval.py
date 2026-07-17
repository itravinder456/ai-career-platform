"""
RAG retrieval tool — searches the Qdrant collection populated by services/ingestion.

Bound into the career graph's TOOLS list (app/graphs/career.py) so the LLM can call it
mid-response when it needs a specific fact beyond the static profile summary already in
the system prompt. Degrades gracefully (returns a plain string, never raises) so a
Qdrant/OpenAI hiccup doesn't crash the chat turn — same non-fatal-if-infra-down spirit as
services/api's lifespan checks.
"""

from langchain_core.tools import tool
from qdrant_client import AsyncQdrantClient

from core.config import get_settings
from core.embeddings import embed_query
from core.logging.setup import get_logger

log = get_logger(__name__)

RESULT_LIMIT = 4

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


async def retrieve_context(query: str, limit: int = RESULT_LIMIT) -> str:
    """Core retrieval logic — called directly for mandatory context injection (career-
    related graph nodes) and wrapped as a tool below for the LLM's own follow-up calls."""
    settings = get_settings()

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
        return "No relevant information found in the knowledge base."

    return "\n\n".join(f"[{p.payload['source']}] {p.payload['text']}" for p in response.points)


@tool
async def search_knowledge_base(query: str) -> str:
    """Search Ravinder's indexed knowledge base (resume, projects, blogs) for specific
    facts, metrics, or details not already covered in the system prompt. Use this when
    you need precise information beyond the general profile summary."""
    return await retrieve_context(query)

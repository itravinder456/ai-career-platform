from unittest.mock import AsyncMock, MagicMock

from app.tools import retrieval


def _mock_no_cache(monkeypatch):
    """Existing tests care about the Qdrant/embedding path, not caching — keep them
    isolated from a real Redis connection the same way they're already isolated from
    real Qdrant/embedding calls."""
    monkeypatch.setattr(retrieval, "cache_get", AsyncMock(return_value=None))
    monkeypatch.setattr(retrieval, "cache_set", AsyncMock())


async def test_search_knowledge_base_formats_hits(monkeypatch):
    _mock_no_cache(monkeypatch)
    monkeypatch.setattr(retrieval, "embed_query", AsyncMock(return_value=[0.1, 0.2, 0.3]))

    point = MagicMock()
    point.payload = {
        "source": "resume/profile.md",
        "text": "Ravinder is a Senior AI Platform Engineer.",
    }
    response = MagicMock()
    response.points = [point]

    qdrant_client = MagicMock()
    qdrant_client.query_points = AsyncMock(return_value=response)
    monkeypatch.setattr(retrieval, "get_qdrant_client", lambda: qdrant_client)

    result = await retrieval.search_knowledge_base.ainvoke({"query": "what is Ravinder's title"})

    assert "resume/profile.md" in result
    assert "Senior AI Platform Engineer" in result

    qdrant_client.query_points.assert_awaited_once()
    _, kwargs = qdrant_client.query_points.await_args
    assert kwargs["query"] == [0.1, 0.2, 0.3]
    assert kwargs["limit"] == retrieval.RESULT_LIMIT


async def test_search_knowledge_base_no_hits(monkeypatch):
    _mock_no_cache(monkeypatch)
    monkeypatch.setattr(retrieval, "embed_query", AsyncMock(return_value=[0.1]))

    response = MagicMock()
    response.points = []
    qdrant_client = MagicMock()
    qdrant_client.query_points = AsyncMock(return_value=response)
    monkeypatch.setattr(retrieval, "get_qdrant_client", lambda: qdrant_client)

    result = await retrieval.search_knowledge_base.ainvoke({"query": "anything"})

    assert "No relevant information" in result


async def test_search_knowledge_base_degrades_gracefully_on_error(monkeypatch):
    _mock_no_cache(monkeypatch)
    monkeypatch.setattr(retrieval, "embed_query", AsyncMock(side_effect=RuntimeError("boom")))

    result = await retrieval.search_knowledge_base.ainvoke({"query": "anything"})

    assert "temporarily unavailable" in result


# ── Caching behaviour ───────────────────────────────────────────────────────────


async def test_retrieve_context_cache_hit_skips_qdrant_and_embedding(monkeypatch):
    monkeypatch.setattr(retrieval, "cache_get", AsyncMock(return_value="[cached] answer"))
    embed_query = AsyncMock()
    monkeypatch.setattr(retrieval, "embed_query", embed_query)
    qdrant_client = MagicMock()
    qdrant_client.query_points = AsyncMock()
    monkeypatch.setattr(retrieval, "get_qdrant_client", lambda: qdrant_client)

    result = await retrieval.retrieve_context("what is your tech stack")

    assert result == "[cached] answer"
    embed_query.assert_not_awaited()
    qdrant_client.query_points.assert_not_awaited()


async def test_retrieve_context_cache_miss_populates_cache(monkeypatch):
    monkeypatch.setattr(retrieval, "cache_get", AsyncMock(return_value=None))
    cache_set = AsyncMock()
    monkeypatch.setattr(retrieval, "cache_set", cache_set)
    monkeypatch.setattr(retrieval, "embed_query", AsyncMock(return_value=[0.1]))

    point = MagicMock()
    point.payload = {"source": "resume/profile.md", "text": "Python, FastAPI, LangGraph."}
    response = MagicMock()
    response.points = [point]
    qdrant_client = MagicMock()
    qdrant_client.query_points = AsyncMock(return_value=response)
    monkeypatch.setattr(retrieval, "get_qdrant_client", lambda: qdrant_client)

    result = await retrieval.retrieve_context("what is your tech stack")

    cache_set.assert_awaited_once()
    args, _ = cache_set.await_args
    cached_key, cached_value, ttl = args
    assert cached_value == result
    assert ttl == retrieval.CACHE_TTL_SECONDS
    assert cached_key.startswith("rag:")


async def test_retrieve_context_failure_is_never_cached(monkeypatch):
    monkeypatch.setattr(retrieval, "cache_get", AsyncMock(return_value=None))
    cache_set = AsyncMock()
    monkeypatch.setattr(retrieval, "cache_set", cache_set)
    monkeypatch.setattr(retrieval, "embed_query", AsyncMock(side_effect=RuntimeError("boom")))

    result = await retrieval.retrieve_context("anything")

    assert "temporarily unavailable" in result
    cache_set.assert_not_awaited()


def test_cache_key_is_stable_and_normalizes_whitespace_and_case():
    key1 = retrieval._cache_key("ravinder", "What is your Tech Stack?")
    key2 = retrieval._cache_key("ravinder", "  what   is your tech stack?  ")

    assert key1 == key2
    assert key1.startswith("rag:ravinder:")


def test_cache_key_differs_across_collections():
    key1 = retrieval._cache_key("collection_a", "same query")
    key2 = retrieval._cache_key("collection_b", "same query")

    assert key1 != key2

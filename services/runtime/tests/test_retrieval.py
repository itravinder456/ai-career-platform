from unittest.mock import AsyncMock, MagicMock

from app.tools import retrieval


async def test_search_knowledge_base_formats_hits(monkeypatch):
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
    monkeypatch.setattr(retrieval, "embed_query", AsyncMock(return_value=[0.1]))

    response = MagicMock()
    response.points = []
    qdrant_client = MagicMock()
    qdrant_client.query_points = AsyncMock(return_value=response)
    monkeypatch.setattr(retrieval, "get_qdrant_client", lambda: qdrant_client)

    result = await retrieval.search_knowledge_base.ainvoke({"query": "anything"})

    assert "No relevant information" in result


async def test_search_knowledge_base_degrades_gracefully_on_error(monkeypatch):
    monkeypatch.setattr(retrieval, "embed_query", AsyncMock(side_effect=RuntimeError("boom")))

    result = await retrieval.search_knowledge_base.ainvoke({"query": "anything"})

    assert "temporarily unavailable" in result

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from core.embeddings import factory


def _settings(**overrides):
    defaults = dict(
        embedding_provider="openai",
        embedding_model="text-embedding-3-small",
        ollama_base_url="http://localhost:11434",
        openai_api_key=None,
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


async def test_embed_texts_openai_branch(monkeypatch):
    monkeypatch.setattr(factory, "get_settings", lambda: _settings(embedding_provider="openai"))

    response = MagicMock()
    response.data = [MagicMock(embedding=[0.1, 0.2]), MagicMock(embedding=[0.3, 0.4])]
    openai_client = MagicMock()
    openai_client.embeddings.create = AsyncMock(return_value=response)
    monkeypatch.setattr(factory, "_get_openai_client", lambda: openai_client)

    result = await factory.embed_texts(["a", "b"])

    assert result == [[0.1, 0.2], [0.3, 0.4]]
    openai_client.embeddings.create.assert_awaited_once_with(
        model="text-embedding-3-small", input=["a", "b"]
    )


async def test_embed_texts_ollama_branch(monkeypatch):
    monkeypatch.setattr(
        factory,
        "get_settings",
        lambda: _settings(embedding_provider="ollama", embedding_model="nomic-embed-text"),
    )

    http_response = MagicMock()
    http_response.json.return_value = {"embeddings": [[0.5, 0.6]]}
    http_response.raise_for_status = MagicMock()

    http_client = MagicMock()
    http_client.post = AsyncMock(return_value=http_response)
    monkeypatch.setattr(factory, "_get_http_client", lambda: http_client)

    result = await factory.embed_texts(["hello"])

    assert result == [[0.5, 0.6]]
    http_client.post.assert_awaited_once_with(
        "http://localhost:11434/api/embed",
        json={"model": "nomic-embed-text", "input": ["hello"]},
    )


async def test_embed_query_returns_single_vector(monkeypatch):
    monkeypatch.setattr(factory, "get_settings", lambda: _settings())
    monkeypatch.setattr(factory, "embed_texts", AsyncMock(return_value=[[0.1, 0.2]]))

    result = await factory.embed_query("hi")

    assert result == [0.1, 0.2]


async def test_embed_texts_empty_list_short_circuits(monkeypatch):
    monkeypatch.setattr(factory, "get_settings", lambda: _settings())

    result = await factory.embed_texts([])

    assert result == []


async def test_unknown_provider_raises(monkeypatch):
    monkeypatch.setattr(factory, "get_settings", lambda: _settings(embedding_provider="bogus"))

    with pytest.raises(ValueError, match="Unknown EMBEDDING_PROVIDER"):
        await factory.embed_texts(["x"])

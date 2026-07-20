"""
Provider-agnostic embeddings — switch EMBEDDING_PROVIDER in a service's .env, no code change.
Mirrors services/runtime/app/graphs/career.py's _build_llm() pattern for chat LLM providers.

openai/httpx are imported lazily inside the provider functions, not at module scope, so that
importing this package doesn't force those dependencies onto any consumer that doesn't actually
call embed_texts/embed_query — same reasoning as the lazy FastAPI import in
core/exceptions/handlers.py.
"""

from core.config import get_settings
from core.logging.setup import get_logger

log = get_logger(__name__)

_openai_client = None
_http_client = None


def _get_openai_client():
    global _openai_client
    if _openai_client is None:
        from openai import AsyncOpenAI

        s = get_settings()
        api_key = s.openai_api_key.get_secret_value() if s.openai_api_key else None
        _openai_client = AsyncOpenAI(api_key=api_key)
    return _openai_client


def _get_http_client():
    global _http_client
    if _http_client is None:
        import httpx

        _http_client = httpx.AsyncClient(timeout=60.0)
    return _http_client


async def _embed_openai(texts: list[str]) -> list[list[float]]:
    s = get_settings()
    client = _get_openai_client()
    response = await client.embeddings.create(model=s.embedding_model, input=texts)
    return [item.embedding for item in response.data]


async def _embed_ollama(texts: list[str]) -> list[list[float]]:
    s = get_settings()
    client = _get_http_client()
    response = await client.post(
        f"{s.ollama_base_url}/api/embed",
        json={"model": s.embedding_model, "input": texts},
    )
    response.raise_for_status()
    return response.json()["embeddings"]


_PROVIDERS = {
    "openai": _embed_openai,
    "ollama": _embed_ollama,
}


async def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    s = get_settings()
    provider = s.embedding_provider.lower()
    embed_fn = _PROVIDERS.get(provider)
    if embed_fn is None:
        raise ValueError(
            f"Unknown EMBEDDING_PROVIDER '{provider}' — expected one of {list(_PROVIDERS)}"
        )

    return await embed_fn(texts)


async def embed_query(text: str) -> list[float]:
    embeddings = await embed_texts([text])
    return embeddings[0]


async def close_embedder() -> None:
    global _openai_client, _http_client
    if _openai_client is not None:
        await _openai_client.close()
        _openai_client = None
    if _http_client is not None:
        await _http_client.aclose()
        _http_client = None

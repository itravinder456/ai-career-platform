import json
from typing import Any

import redis.asyncio as aioredis

from app.core.settings import get_settings
from core.logging.setup import get_logger

log = get_logger("runtime.memory")

_client: aioredis.Redis | None = None  # type: ignore[type-arg]


def _get_client() -> aioredis.Redis:  # type: ignore[type-arg]
    global _client
    if _client is None:
        s = get_settings()
        _client = aioredis.from_url(
            s.redis_url.get_secret_value(),
            max_connections=s.redis_max_connections,
            decode_responses=True,
        )
    return _client


async def close_redis() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def get_session_history(session_id: str) -> list[dict[str, Any]]:
    client = _get_client()
    s = get_settings()
    try:
        raw = await client.get(f"runtime:session:{session_id}")
        return json.loads(raw) if raw else []
    except Exception as exc:
        log.warning("session.get.error", session_id=session_id, error=str(exc))
        return []


async def save_session_history(session_id: str, history: list[dict[str, Any]]) -> None:
    client = _get_client()
    s = get_settings()
    try:
        await client.setex(
            f"runtime:session:{session_id}",
            s.session_ttl_seconds,
            json.dumps(history),
        )
    except Exception as exc:
        log.warning("session.save.error", session_id=session_id, error=str(exc))

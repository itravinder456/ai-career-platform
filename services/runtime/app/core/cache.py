"""
Redis-backed cache — see docs/CACHING.md for the design and rationale. Every function
here degrades gracefully: a Redis outage (or REDIS_URL simply not being configured)
falls back to "no cache" rather than breaking the caller, matching every other
infra touchpoint in this service (app.tools.retrieval, app.executor.task_executor's
sufficiency check, app.knowledge.profile).
"""

import redis.asyncio as aioredis

from core.config import get_settings
from core.logging.setup import get_logger

log = get_logger(__name__)

_client: aioredis.Redis | None = None


def _get_client() -> aioredis.Redis | None:
    global _client
    settings = get_settings()
    if not settings.redis_url:
        return None
    if _client is None:
        _client = aioredis.Redis.from_url(
            settings.redis_url.get_secret_value(), decode_responses=True
        )
    return _client


async def cache_get(key: str) -> str | None:
    client = _get_client()
    if client is None:
        return None
    try:
        value = await client.get(key)
        # decode_responses=True on the client guarantees str at runtime; the redis-py
        # stubs still type .get() as bytes | Any | None regardless, so make the
        # contract explicit rather than silencing the checker.
        return None if value is None else str(value)
    except Exception as exc:
        log.warning("cache.unavailable", operation="get", error=str(exc))
        return None


async def cache_set(key: str, value: str, ttl_seconds: int) -> None:
    client = _get_client()
    if client is None:
        return
    try:
        await client.set(key, value, ex=ttl_seconds)
    except Exception as exc:
        log.warning("cache.unavailable", operation="set", error=str(exc))


async def close_cache() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None

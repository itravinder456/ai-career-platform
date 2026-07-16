import redis.asyncio as aioredis

from core.config import get_settings

_pool: aioredis.ConnectionPool | None = None
_client: aioredis.Redis | None = None  # type: ignore[type-arg]


def get_redis_client() -> aioredis.Redis:  # type: ignore[type-arg]
    global _client, _pool
    if _client is None:
        s = get_settings()
        url = s.redis_url.get_secret_value()
        _pool = aioredis.ConnectionPool.from_url(
            url,
            max_connections=s.redis_max_connections,
            decode_responses=True,
        )
        _client = aioredis.Redis(connection_pool=_pool)
    return _client


async def close_redis() -> None:
    global _client, _pool
    if _client is not None:
        await _client.aclose()
        _client = None
    if _pool is not None:
        await _pool.aclose()
        _pool = None

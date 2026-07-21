from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import Request

from app.core.rate_limit import check_rate_limit
from app.dependencies.rate_limit import _client_identifier
from core.exceptions.base import RateLimitError


def _fake_redis_with_store(store: dict[str, int]) -> MagicMock:
    async def _incr(key: str) -> int:
        store[key] = store.get(key, 0) + 1
        return store[key]

    redis = MagicMock()
    redis.incr = AsyncMock(side_effect=_incr)
    redis.expire = AsyncMock(return_value=True)
    return redis


async def test_check_rate_limit_allows_requests_under_both_limits():
    redis = _fake_redis_with_store({})

    for _ in range(5):
        await check_rate_limit(redis, "1.2.3.4", per_minute=10, per_day=100)
    # Must not raise.


async def test_check_rate_limit_raises_once_minute_window_exceeded():
    redis = _fake_redis_with_store({})

    for _ in range(3):
        await check_rate_limit(redis, "1.2.3.4", per_minute=3, per_day=100)

    with pytest.raises(RateLimitError) as exc_info:
        await check_rate_limit(redis, "1.2.3.4", per_minute=3, per_day=100)

    assert exc_info.value.details["retry_after_seconds"] == 60


async def test_check_rate_limit_raises_once_day_window_exceeded():
    redis = _fake_redis_with_store({})

    for _ in range(5):
        await check_rate_limit(redis, "1.2.3.4", per_minute=1000, per_day=5)

    with pytest.raises(RateLimitError) as exc_info:
        await check_rate_limit(redis, "1.2.3.4", per_minute=1000, per_day=5)

    assert exc_info.value.details["retry_after_seconds"] == 86400


async def test_check_rate_limit_tracks_identifiers_independently():
    redis = _fake_redis_with_store({})

    for _ in range(3):
        await check_rate_limit(redis, "client-a", per_minute=3, per_day=100)

    # A different identifier has its own budget — must not raise.
    await check_rate_limit(redis, "client-b", per_minute=3, per_day=100)


async def test_check_rate_limit_fails_open_on_redis_error():
    redis = MagicMock()
    redis.incr = AsyncMock(side_effect=ConnectionError("redis down"))

    # Must not raise even though Redis is unreachable — matches the fail-open
    # convention used everywhere else infra is touched in this codebase.
    await check_rate_limit(redis, "1.2.3.4", per_minute=1, per_day=1)


def test_client_identifier_prefers_x_forwarded_for():
    request = Request(
        scope={
            "type": "http",
            "headers": [(b"x-forwarded-for", b"203.0.113.5, 10.0.0.1")],
            "client": ("10.0.0.1", 12345),
        }
    )
    assert _client_identifier(request) == "203.0.113.5"


def test_client_identifier_falls_back_to_request_client():
    request = Request(
        scope={"type": "http", "headers": [], "client": ("127.0.0.1", 12345)}
    )
    assert _client_identifier(request) == "127.0.0.1"


def test_client_identifier_handles_missing_client():
    request = Request(scope={"type": "http", "headers": [], "client": None})
    assert _client_identifier(request) == "unknown"

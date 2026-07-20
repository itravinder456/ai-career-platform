from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

from app.core import cache


class _FakeSecret:
    def __init__(self, value):
        self._value = value

    def get_secret_value(self):
        return self._value


async def test_cache_get_returns_none_when_redis_url_not_configured(monkeypatch):
    monkeypatch.setattr(cache, "get_settings", lambda: SimpleNamespace(redis_url=None))

    result = await cache.cache_get("some-key")

    assert result is None


async def test_cache_get_returns_none_and_logs_warning_on_redis_error(monkeypatch):
    monkeypatch.setattr(cache, "_client", None)
    monkeypatch.setattr(
        cache, "get_settings", lambda: SimpleNamespace(redis_url=_FakeSecret("redis://x"))
    )
    fake_client = MagicMock()
    fake_client.get = AsyncMock(side_effect=ConnectionError("down"))
    monkeypatch.setattr(cache.aioredis.Redis, "from_url", lambda *a, **k: fake_client)

    result = await cache.cache_get("some-key")

    assert result is None


async def test_cache_set_no_ops_when_redis_unavailable(monkeypatch):
    monkeypatch.setattr(cache, "_client", None)
    monkeypatch.setattr(
        cache, "get_settings", lambda: SimpleNamespace(redis_url=_FakeSecret("redis://x"))
    )
    fake_client = MagicMock()
    fake_client.set = AsyncMock(side_effect=ConnectionError("down"))
    monkeypatch.setattr(cache.aioredis.Redis, "from_url", lambda *a, **k: fake_client)

    # Must not raise.
    await cache.cache_set("some-key", "value", 60)


async def test_cache_get_set_roundtrip_against_a_fake_client(monkeypatch):
    monkeypatch.setattr(cache, "_client", None)
    monkeypatch.setattr(
        cache, "get_settings", lambda: SimpleNamespace(redis_url=_FakeSecret("redis://x"))
    )
    store: dict[str, str] = {}
    fake_client = MagicMock()
    fake_client.get = AsyncMock(side_effect=lambda k: store.get(k))
    fake_client.set = AsyncMock(side_effect=lambda k, v, ex=None: store.__setitem__(k, v))
    monkeypatch.setattr(cache.aioredis.Redis, "from_url", lambda *a, **k: fake_client)

    await cache.cache_set("key", "value", 60)
    result = await cache.cache_get("key")

    assert result == "value"

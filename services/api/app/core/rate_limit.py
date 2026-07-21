"""
Redis-backed fixed-window rate limiting for the public /chat endpoint — the only
route that fans out to paid OpenAI calls plus Qdrant/Postgres work, so it's the one
worth protecting from a single client running up cost.

Two independent windows, both must pass: a per-minute window catches a fast bot,
a per-day window catches one that paces itself under the per-minute cap but keeps
going all day. Fixed-window (INCR + EXPIRE), not sliding — simple, and the
imprecision at window edges doesn't matter for a cost-protection guard on a
single-person portfolio site.

Fails open on a Redis outage — same convention as every other infra touchpoint in
this codebase (app.tools.retrieval / app.core.cache in services/runtime): a rate
limiter that can take down the whole chat because Redis hiccuped would be a worse
outcome than temporarily having no rate limiting.
"""

from redis.asyncio import Redis

from core.exceptions.base import RateLimitError
from core.logging.setup import get_logger

log = get_logger(__name__)


async def _under_limit(redis: Redis, key: str, limit: int, window_seconds: int) -> bool:
    try:
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, window_seconds)
        return count <= limit
    except Exception as exc:
        log.warning("rate_limit.check_failed", error=str(exc))
        return True


async def check_rate_limit(
    redis: Redis,
    identifier: str,
    per_minute: int,
    per_day: int,
) -> None:
    """Raises RateLimitError if `identifier` has exceeded either window."""
    minute_key = f"ratelimit:min:{identifier}"
    if not await _under_limit(redis, minute_key, per_minute, window_seconds=60):
        log.warning("rate_limit.exceeded", identifier=identifier, window="minute")
        raise RateLimitError(
            message="Too many requests — please slow down and try again in a minute.",
            details={"retry_after_seconds": 60},
        )

    day_key = f"ratelimit:day:{identifier}"
    if not await _under_limit(redis, day_key, per_day, window_seconds=86400):
        log.warning("rate_limit.exceeded", identifier=identifier, window="day")
        raise RateLimitError(
            message="Daily message limit reached — please try again tomorrow.",
            details={"retry_after_seconds": 86400},
        )

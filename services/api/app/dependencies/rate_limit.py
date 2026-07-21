from typing import Annotated

from fastapi import Depends, Request

from app.core.rate_limit import check_rate_limit
from app.db.redis import get_redis_client
from app.dependencies.settings import Settings


def _client_identifier(request: Request) -> str:
    # In production, Caddy reverse-proxies every request and sets X-Forwarded-For to
    # the real client IP — request.client.host would otherwise resolve to Caddy's own
    # container IP, collapsing every visitor onto one shared rate-limit bucket. Falls
    # back to request.client.host for local/direct access with no proxy in front.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def enforce_rate_limit(request: Request, settings: Settings) -> None:
    identifier = _client_identifier(request)
    redis = get_redis_client()
    await check_rate_limit(
        redis,
        identifier,
        per_minute=settings.rate_limit_per_minute,
        per_day=settings.rate_limit_per_day,
    )


RateLimit = Annotated[None, Depends(enforce_rate_limit)]

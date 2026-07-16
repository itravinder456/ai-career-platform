from typing import Annotated

import redis.asyncio as aioredis
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.postgres import get_db_session
from app.db.redis import get_redis_client


async def get_db() -> AsyncSession:  # type: ignore[return]
    async for session in get_db_session():
        yield session


def get_redis() -> aioredis.Redis:  # type: ignore[type-arg]
    return get_redis_client()


DB = Annotated[AsyncSession, Depends(get_db)]
Redis = Annotated[aioredis.Redis, Depends(get_redis)]  # type: ignore[type-arg]

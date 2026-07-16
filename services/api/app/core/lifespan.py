from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.logging import log, setup_logging
from app.db.postgres import close_db, init_db
from app.db.qdrant import close_qdrant, ensure_collection
from app.db.redis import close_redis, get_redis_client


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    log.info("api.startup")

    try:
        await init_db()
        log.info("postgres.ready")
    except Exception as exc:
        log.warning("postgres.unavailable", error=str(exc))

    try:
        get_redis_client()
        log.info("redis.ready")
    except Exception as exc:
        log.warning("redis.unavailable", error=str(exc))

    try:
        await ensure_collection()
        log.info("qdrant.ready")
    except Exception as exc:
        log.warning("qdrant.unavailable", error=str(exc))

    yield

    await close_db()
    await close_redis()
    await close_qdrant()
    log.info("api.shutdown")

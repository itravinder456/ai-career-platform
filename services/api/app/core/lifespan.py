from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.clients.http import close_http_client, get_http_client
from app.db.postgres import close_db, init_db
from app.db.qdrant import close_qdrant, ensure_collection
from app.db.redis import close_redis, get_redis_client
from core.config import get_settings
from core.logging.setup import configure_logging, get_logger
from core.telemetry import configure_telemetry

log = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(service=settings.app_name, level=settings.log_level)
    configure_telemetry(
        settings.otel_service_name or settings.app_name,
        settings.otel_endpoint,
        settings.otel_headers,
    )
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

    get_http_client()
    log.info("http_client.ready")

    yield

    await close_db()
    await close_redis()
    await close_qdrant()
    await close_http_client()
    log.info("api.shutdown")

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.core.logging import log
from app.db.postgres import get_engine
from app.db.qdrant import get_qdrant_client
from app.db.redis import get_redis_client

router = APIRouter()


@router.get("/health")
async def health() -> JSONResponse:
    checks: dict[str, str] = {}

    # Redis
    try:
        await get_redis_client().ping()
        checks["redis"] = "ok"
    except Exception as exc:
        log.warning("health.redis.fail", error=str(exc))
        checks["redis"] = f"unreachable: {exc}"

    # Postgres
    try:
        from sqlalchemy import text
        async with get_engine().connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["postgres"] = "ok"
    except Exception as exc:
        log.warning("health.postgres.fail", error=str(exc))
        checks["postgres"] = f"unreachable: {exc}"

    # Qdrant
    try:
        await get_qdrant_client().get_collections()
        checks["qdrant"] = "ok"
    except Exception as exc:
        log.warning("health.qdrant.fail", error=str(exc))
        checks["qdrant"] = f"unreachable: {exc}"

    all_ok = all(v == "ok" for v in checks.values())
    return JSONResponse(
        status_code=200 if all_ok else 206,
        content={"status": "ok" if all_ok else "degraded", "services": checks},
    )

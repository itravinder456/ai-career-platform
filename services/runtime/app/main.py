from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.v1 import health, run
from app.core.logging import log, setup_logging
from app.core.settings import get_settings
from app.memory.session import close_redis

_settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    log.info("runtime.startup", model=_settings.anthropic_model)
    yield
    await close_redis()
    log.info("runtime.shutdown")


app = FastAPI(
    title="Ravinder AI — Runtime",
    version="0.1.0",
    docs_url="/docs" if not _settings.is_production else None,
    redoc_url=None,
    lifespan=lifespan,
)

app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(run.router, prefix="/api/v1", tags=["run"])

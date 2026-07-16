import sys
from contextlib import asynccontextmanager

# psycopg's async mode can't run on Windows' default ProactorEventLoop — must be
# set before uvicorn creates its event loop, and before the --reload subprocess
# spawn re-imports this module. No-op on Linux/Docker (ProactorEventLoop doesn't
# exist there). Needed here (not just run_dev.py) so `python -m app.main` works too.
if sys.platform == "win32":
    import asyncio

    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI

from app.api.v1 import health, run
from app.graphs.career import build_career_graph
from app.memory import close_checkpointer, init_checkpointer
from core.config import get_settings
from core.exceptions import register_exception_handlers
from core.logging.setup import configure_logging, get_logger

log = get_logger(__name__)
_settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging(service=_settings.app_name, level=_settings.log_level)
    checkpointer = await init_checkpointer()
    app.state.career_graph = build_career_graph(checkpointer)
    app.state.checkpointer = checkpointer
    log.info("runtime.startup", model=_settings.anthropic_model)
    yield
    await close_checkpointer()
    log.info("runtime.shutdown")


app = FastAPI(
    title="Ravinder AI — Runtime",
    version="0.1.0",
    docs_url="/docs" if not _settings.is_production else None,
    redoc_url=None,
    lifespan=lifespan,
)

# ── Exception handlers ────────────────────────────────────────────────────────
register_exception_handlers(app)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(run.router, prefix="/api/v1", tags=["run"])

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=_settings.host,
        port=_settings.port,
        reload=not _settings.is_production,
    )

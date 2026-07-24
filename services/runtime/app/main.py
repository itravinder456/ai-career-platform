import os
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
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor


from app.api.v1 import health, run
from app.core.cache import close_cache
from app.graphs.career import build_career_graph
from app.memory import close_checkpointer, init_checkpointer
from app.tools.retrieval import close_qdrant, get_qdrant_client
from core.config import get_settings
from core.embeddings import close_embedder
from core.exceptions import register_exception_handlers
from core.logging.setup import configure_logging, get_logger
from core.telemetry import configure_telemetry

log = get_logger(__name__)
_settings = get_settings()

# LangChain's tracer reads LANGSMITH_* straight from the OS environment — but
# pydantic-settings' env_file parsing only populates our own `settings` object, it
# never writes back to os.environ. Without this bridge, LANGSMITH_TRACING=true in
# .env would silently do nothing: no error, just zero traces ever sent.
if _settings.langsmith_tracing:
    os.environ["LANGSMITH_TRACING"] = "true"
    os.environ["LANGSMITH_PROJECT"] = _settings.langsmith_project
    if _settings.langsmith_api_key:
        os.environ["LANGSMITH_API_KEY"] = _settings.langsmith_api_key.get_secret_value()


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging(service=_settings.app_name, level=_settings.log_level)
    configure_telemetry(
        _settings.otel_service_name or _settings.app_name,
        _settings.otel_endpoint,
        _settings.otel_headers,
    )
    checkpointer = await init_checkpointer()
    app.state.career_graph = build_career_graph(checkpointer)
    app.state.checkpointer = checkpointer
    app.state.qdrant_client = get_qdrant_client()
    log.info("runtime.startup", model=_settings.anthropic_model)
    yield
    await close_checkpointer()
    await close_qdrant()
    await close_embedder()
    await close_cache()
    log.info("runtime.shutdown")


app = FastAPI(
    title="RV.AI — Runtime",
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

FastAPIInstrumentor.instrument_app(app)
HTTPXClientInstrumentor().instrument()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=_settings.host,
        port=_settings.port,
        reload=not _settings.is_production,
    )

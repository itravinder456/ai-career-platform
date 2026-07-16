from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.routers import register_routers
from app.core.lifespan import lifespan
from app.core.settings import get_settings
from app.middleware.errors import register_exception_handlers
from app.middleware.logging import RequestLoggingMiddleware

_settings = get_settings()

app = FastAPI(
    title="Ravinder AI — API",
    version="0.1.0",
    docs_url="/docs" if not _settings.is_production else None,
    redoc_url=None,
    lifespan=lifespan,
)

# ── Middleware (order matters: outermost = first to run) ──────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggingMiddleware)

# ── Exception handlers ────────────────────────────────────────────────────────
register_exception_handlers(app)

# ── Routes ────────────────────────────────────────────────────────────────────
register_routers(app)

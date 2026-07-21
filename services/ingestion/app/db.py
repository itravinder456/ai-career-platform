"""
Minimal, read-only Postgres access for ingestion. Deliberately does NOT import
services/api's SQLAlchemy model classes (that would be the first cross-service
import in this repo) — just runs plain SELECT statements against the schema
services/api's Alembic migrations own.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from core.config import get_settings

_engine = None
_session_factory = None


def get_engine():
    global _engine
    if _engine is None:
        s = get_settings()
        if s.database_url is None:
            raise RuntimeError("DATABASE_URL is not configured for services/ingestion")
        db_url = s.database_url.get_secret_value().replace("postgresql://", "postgresql+asyncpg://")
        # NullPool: ingestion is a short-lived one-shot CLI run (`make ingest`),
        # not a long-running server — no benefit to a persistent connection pool.
        _engine = create_async_engine(db_url, poolclass=NullPool, echo=s.db_echo)
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(get_engine(), expire_on_commit=False, class_=AsyncSession)
    return _session_factory


async def close_db() -> None:
    global _engine
    if _engine is not None:
        await _engine.dispose()
        _engine = None

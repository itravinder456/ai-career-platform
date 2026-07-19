from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from core.config import get_settings

_engine = None
_session_factory = None


class Base(DeclarativeBase):
    pass


def get_engine():
    global _engine
    if _engine is None:
        s = get_settings()
        db_url = s.database_url.get_secret_value().replace(
            "postgresql://", "postgresql+asyncpg://"
        )
        _engine = create_async_engine(
            db_url,
            pool_size=s.db_pool_size,
            pool_timeout=s.db_pool_timeout,
            pool_pre_ping=True,
            echo=s.db_echo,
        )
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            get_engine(),
            expire_on_commit=False,
            class_=AsyncSession,
        )
    return _session_factory


async def init_db() -> None:
    """
    Verifies Postgres is reachable at startup — does NOT create tables. Alembic
    (see app/../alembic/) is the sole owner of schema; a stray `create_all` here
    previously let any new SQLAlchemy model silently create its own table on the
    next restart, bypassing migrations entirely and drifting out of sync with
    what `alembic history` thinks has happened. Run `alembic upgrade head`
    instead of relying on this to prepare a fresh database.
    """
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))


async def close_db() -> None:
    global _engine
    if _engine is not None:
        await _engine.dispose()
        _engine = None


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

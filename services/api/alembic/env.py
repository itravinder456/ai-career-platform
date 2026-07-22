import asyncio
import os
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

import app.db.models  # noqa: F401 — registers all model metadata with Base
from app.db.postgres import Base
from core.config import AppSettings

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# DATABASE_URL comes from services/api/.env via AppSettings, not alembic.ini —
# keeps the connection string in one place. Bypasses the shared get_settings()
# cache on purpose: it hardcodes ".env", but `make prod-migrate` needs this
# pointed at .env.prod instead. ALEMBIC_ENV_FILE lets it do that without
# changing get_settings()'s signature for runtime/ingestion, which don't need
# this. Load it via AppSettings' own dotenv parsing (pydantic-settings), not
# `uv run --env-file` — that path mis-parses JSON-shaped values like
# CORS_ORIGINS (["https://..."]) into something that isn't valid JSON anymore,
# raising SettingsError before alembic ever runs.
_env_file = os.environ.get("ALEMBIC_ENV_FILE", ".env")
_settings = AppSettings(_env_file=_env_file)
config.set_main_option(
    "sqlalchemy.url",
    _settings.database_url.get_secret_value().replace("postgresql://", "postgresql+asyncpg://"),
)


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())

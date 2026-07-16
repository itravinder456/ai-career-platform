from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from core.config import get_settings
from core.logging.setup import get_logger

log = get_logger(__name__)

_pool: AsyncConnectionPool | None = None
_checkpointer: AsyncPostgresSaver | None = None


async def init_checkpointer() -> AsyncPostgresSaver:
    """
    Builds the connection pool + checkpointer once at startup. .setup() creates
    the checkpoint tables if they don't exist yet — safe to call every boot.
    """
    global _pool, _checkpointer
    if _checkpointer is None:
        s = get_settings()
        db_url = s.database_url.get_secret_value()
        _pool = AsyncConnectionPool(
            conninfo=db_url,
            max_size=10,
            kwargs={"autocommit": True, "row_factory": dict_row},
            open=False,
        )
        await _pool.open()
        _checkpointer = AsyncPostgresSaver(_pool)
        await _checkpointer.setup()
        log.info("checkpointer.ready")
    return _checkpointer


def get_checkpointer() -> AsyncPostgresSaver:
    if _checkpointer is None:
        raise RuntimeError("Checkpointer not initialized — init_checkpointer() must run at startup")
    return _checkpointer


async def close_checkpointer() -> None:
    global _pool, _checkpointer
    if _pool is not None:
        await _pool.close()
        _pool = None
    _checkpointer = None

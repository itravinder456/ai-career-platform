import asyncio

from core.config import get_settings
from core.embeddings import close_embedder
from core.logging.setup import configure_logging, get_logger

from app.db import close_db
from app.pipeline import run_ingestion
from app.store import close_qdrant

log = get_logger(__name__)


async def _main() -> None:
    settings = get_settings()
    configure_logging(service=settings.app_name, level=settings.log_level)

    log.info("ingestion.start")
    try:
        result = await run_ingestion()
    finally:
        await close_embedder()
        await close_qdrant()
        await close_db()

    log.info(
        "ingestion.complete",
        files_loaded=result.files_loaded,
        chunks_generated=result.chunks_generated,
        chunks_deduplicated=result.chunks_deduplicated,
        chunks_upserted=result.chunks_upserted,
    )
    print(
        f"Ingestion complete — files: {result.files_loaded}, "
        f"chunks generated: {result.chunks_generated}, "
        f"deduplicated: {result.chunks_deduplicated}, "
        f"upserted: {result.chunks_upserted}"
    )


if __name__ == "__main__":
    asyncio.run(_main())

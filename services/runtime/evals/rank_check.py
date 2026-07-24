"""One-off: see where the "right" chunk actually ranks for a query, beyond RESULT_LIMIT.
Run: PYTHONPATH=. uv run python evals/rank_check.py "some question"
"""

import asyncio
import sys

from app.tools.retrieval import get_qdrant_client
from core.config import get_settings
from core.embeddings import embed_query


async def main(query: str, top_k: int = 15) -> None:
    settings = get_settings()
    embedding = await embed_query(query)
    response = await get_qdrant_client().query_points(
        collection_name=settings.qdrant_collection,
        query=embedding,
        limit=top_k,
    )
    print(f"\nQuery: {query!r}  (RESULT_LIMIT in prod = 4)\n")
    for i, p in enumerate(response.points, start=1):
        marker = " <-- inside current top-4" if i <= 4 else ""
        source = p.payload["source"]
        preview = p.payload["text"][:90].replace("\n", " ")
        print(f"{i:2d}. score={p.score:.4f}  [{source}]{marker}\n     {preview}...")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "Walk me through your most complex project"))

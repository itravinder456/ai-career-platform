"""
Full-turn response cache — see docs/CACHING.md. Unlike app.tools.retrieval's cache
(which only skips the Qdrant search), a hit here skips plan_tasks, every execute_task,
and the final respond() LLM call entirely — the three separate model calls one chat turn
costs. Keyed purely by the normalized question text, deliberately not scoped to session
or conversation position: this is a single-person portfolio site, not a multi-tenant
product with per-user answers, so the simplest thing that works is reusing an identical
question's answer wherever it recurs. Conversation continuity for follow-ups is
preserved separately — see app/api/v1/run.py's use of aupdate_state on a hit.
"""

import hashlib
import json

from app.core.cache import cache_get, cache_set
from core.logging.setup import get_logger

log = get_logger(__name__)

TTL_SECONDS = 24 * 60 * 60  # 24h — matches app.tools.retrieval's cache


def _key(message: str) -> str:
    normalized = " ".join(message.lower().split())
    digest = hashlib.sha256(normalized.encode()).hexdigest()[:32]
    return f"chat:{digest}"


async def get_cached_turn(message: str) -> tuple[str, list[dict]] | None:
    raw = await cache_get(_key(message))
    if raw is None:
        return None
    try:
        payload = json.loads(raw)
        return payload["response"], payload["widgets"]
    except Exception as exc:
        log.warning("response_cache.corrupt", error=str(exc))
        return None


async def set_cached_turn(message: str, response: str, widgets: list[dict]) -> None:
    if not response:
        return
    payload = json.dumps({"response": response, "widgets": widgets})
    await cache_set(_key(message), payload, TTL_SECONDS)

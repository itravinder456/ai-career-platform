"""
Identity-only static knowledge about Ravinder Varikuppala — name, location, contact,
social links. Deliberately does NOT include career facts (experience, skills, projects,
education): those come from RAG retrieval only (app/tools/retrieval.py), against the
real resume indexed in Qdrant by services/ingestion — never from this module.

Postgres (the `profile`/`social_links` tables owned by services/api's Alembic
migrations) is the source of truth here, not a hardcoded string — this module just
reads it and formats it for the system prompt, caching briefly so a chat request
doesn't hit Postgres on every turn.
"""

import time

import psycopg
from psycopg.rows import dict_row

from core.config import get_settings
from core.logging.setup import get_logger

log = get_logger(__name__)

_CACHE_TTL_SECONDS = 300

_cache_text: str | None = None
_cache_time: float = 0.0

# Used only if Postgres is unreachable and no cached copy exists yet — keeps the
# runtime answering instead of hard-failing on a transient DB blip.
_FALLBACK = """
NAME: Ravinder Varikuppala
LOCATION: Hyderabad, India
EMAIL: it.ravinder.456@gmail.com
"""


async def _fetch_profile_text() -> str:
    settings = get_settings()
    db_url = settings.database_url.get_secret_value()

    async with await psycopg.AsyncConnection.connect(db_url, row_factory=dict_row) as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT name, location, email FROM profile WHERE id = 1")
            profile = await cur.fetchone()

            await cur.execute(
                "SELECT platform, url FROM social_links ORDER BY display_order"
            )
            links = await cur.fetchall()

    lines = [
        f"NAME: {profile['name']}",
        f"LOCATION: {profile['location']}",
        f"EMAIL: {profile['email']}",
    ]
    lines += [f"{link['platform'].upper()}: {link['url']}" for link in links]
    return "\n" + "\n".join(lines) + "\n"


async def get_profile_text() -> str:
    global _cache_text, _cache_time

    now = time.monotonic()
    if _cache_text is not None and (now - _cache_time) < _CACHE_TTL_SECONDS:
        return _cache_text

    try:
        _cache_text = await _fetch_profile_text()
        _cache_time = now
    except Exception as exc:
        log.warning("profile.fetch.failed", error=str(exc))
        if _cache_text is None:
            _cache_text = _FALLBACK

    return _cache_text

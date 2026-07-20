# Redis Response Caching — Plan

**Status:** proposed, not implemented. This document is for review before any code changes.

## Context

Recruiters ask a lot of overlapping questions across different sessions — the app's own
sidebar/landing suggestion chips are evidence of this (`frontend/src/lib/questions.ts`):
"What was the hardest technical challenge?", "How did you handle scaling?", "What's your
tech stack?", "Tell me about yourself." Every one of these currently re-runs the full
pipeline from scratch — `plan_tasks` (LLM call) → `execute_task` × N in parallel
(Qdrant retrieval + an OpenAI embedding call each, plus a `_verify_and_refine`
sufficiency-check LLM call each) → `respond` (LLM call) — even when the *exact same
question* was just answered five minutes ago for a different visitor. That's real,
avoidable OpenAI cost and latency.

**What's already there:** `redis` is already a running, healthy container in both
`docker-compose.yml` and `docker-compose.prod.yml`, already configured with
`--maxmemory 128mb --maxmemory-policy allkeys-lru` — an eviction policy that's *already*
cache-appropriate, not something added for this. But it's currently only used for a
liveness ping (`services/api/app/api/v1/health.py`) and FastAPI dependency scaffolding
(`services/api/app/dependencies/db.py`) — nothing actually caches anything in it yet.

**The gap that matters most:** the actual chat/RAG/LLM pipeline lives entirely in
`services/runtime` (`services/api`'s `/api/v1/chat` is a pure SSE proxy/relay to
`runtime`'s `/api/v1/run` — see `services/api/app/api/v1/chat.py`). `services/runtime`
has **no Redis dependency at all** right now — not in `pyproject.toml`, not imported
anywhere, and neither `docker-compose.yml` nor `docker-compose.prod.yml` even injects
`REDIS_URL` into the `runtime` service's environment. Wiring Redis into `runtime` is a
prerequisite for any of this, not an afterthought.

**Existing precedent worth following:** `services/runtime/app/knowledge/profile.py`
already has a simple TTL cache (a module-level variable + timestamp) for profile text.
It's the right *shape* of pattern — cheap, TTL-bounded, fails open — but it's per-process
memory, not shared across `uvicorn --workers N` processes or persistent across restarts,
which is exactly why Redis (already deployed, already shared infra) is the right tool
here instead of just copying that pattern.

## What to cache

Two tiers, deliberately not three — see reasoning below on why a separate
embeddings-only cache doesn't pull its weight here.

### Tier 1 (recommended first): cache `retrieve_context()`

`services/runtime/app/tools/retrieval.py`'s `retrieve_context(query, limit=4)` — RAG
results for a given query text against a fixed knowledge base are deterministic (same
query → same nearest neighbors from Qdrant) and **don't depend on conversation
history**. This is the safest possible thing to cache: no risk of returning a
contextually-wrong answer, ever. It's also where most of the avoidable cost concentrates
— every `execute_task` branch calls it at least once (via the planner-executor fan-out,
see `app/executor/task_executor.py`), and `_verify_and_refine` can trigger a second call
with a reformulated query. Caching it also makes a *separate* embeddings-level cache
mostly redundant for this call site — a cache hit here skips the embedding call
entirely, since `embed_query` is only invoked from inside `retrieve_context`. (Ingestion's
bulk `embed_texts` calls are a one-off batch job, not a repeated-question hot path, so
they don't need caching.)

### Tier 2 (later, optional): cache full first-turn `respond()` output

Bigger win — skips `plan_tasks`, every `execute_task`, *and* the final `respond` LLM call
entirely for a cache hit — but riskier: `respond()` builds its answer from the full
conversation history (`state["messages"]`), so the same question can legitimately
deserve a different answer mid-conversation (e.g. after the user already asked a related
follow-up). This is only safe to cache reliably for the **first message of a fresh
session** — which, conveniently, is exactly the common case: someone lands on the site
and clicks one of the suggestion chips, or types a generic opener. Deferred to a second
phase since it needs more careful key design (must not fire once `userHasSent` history
exists) and isn't needed to get most of the value.

## Design

### Where it lives

New module, `services/runtime/app/core/cache.py`, mirroring `app/core/llm.py`'s
factory-function style (module-level client, lazy-initialized, one `close_*()` for
lifespan cleanup — same shape as `app/memory/checkpointer.py` and
`app/tools/retrieval.py`'s `get_qdrant_client()`). Exposes something like:

```python
async def cache_get(key: str) -> str | None: ...
async def cache_set(key: str, value: str, ttl_seconds: int) -> None: ...
```

`retrieve_context` wraps its existing body with a get/set around the cache key — the
function's public signature and graceful-degradation contract (never raises, always
returns a string) don't change.

### Cache key

Normalize the query (lowercase, collapsed whitespace) then hash it (`sha256`, truncated)
to keep keys compact and side-step special characters — `rag:{qdrant_collection}:{hash}`.
Prefixing by collection name means a knowledge-base swap (different `QDRANT_COLLECTION`)
can't serve stale cross-collection results.

### TTL, not permanent caching

The knowledge base changes when ingestion re-runs (see `docs/DEPLOYMENT.md` step 8 /
"Updating the knowledge base"). A moderate TTL — proposing **24 hours** — bounds
staleness without needing ingestion to know anything about runtime's cache or coordinate
an explicit flush. Simpler than cache invalidation, and the existing `allkeys-lru`
eviction policy is a second, independent safety net if the 128MB cap fills up before TTL
expiry.

### Must fail open — non-negotiable

Every existing infra-touching path in this codebase degrades gracefully rather than
breaking the chat: `retrieve_context` itself never raises (falls back to a plain string
on Qdrant/embedding failure), `_verify_and_refine` fails open on any LLM exception,
`get_profile_text` falls back to a static default. Redis being slow, full, or
momentarily unreachable must follow the same rule — a cache lookup/write failure logs a
warning and falls through to doing the real work, never surfaces as a user-facing error.
This is the main implementation risk to get right, not the caching logic itself.

### Observability

Log `cache.hit` / `cache.miss` (structlog, matching the rest of the codebase's
`log.info("event.name", ...)` convention) so there's an actual hit-rate number to look
at before deciding whether Tier 2 is worth the added complexity.

## Infra wiring needed (currently missing)

- `services/runtime/pyproject.toml` — add `redis` as a dependency (match
  `services/api/pyproject.toml`'s `redis>=8.0.1` pin).
- `docker-compose.yml` and `docker-compose.prod.yml` — add `REDIS_URL:
  redis://redis:6379` to the `runtime` service's `environment:` (copy the line already
  present on `api`) and add `redis: condition: service_healthy` to `runtime`'s
  `depends_on:`.
- `services/runtime/.env` / `.env.prod.example` — add `REDIS_URL` (local:
  `redis://localhost:6379`; production: same in-compose `redis://redis:6379`, no RDS/
  Qdrant-Cloud-style external service needed — Redis stays self-hosted in Docker either
  way, per the existing "ElastiCache isn't reliably free-tier" reasoning in
  `docs/DEPLOYMENT.md`).
- `shared/core/core/config/base.py` already has `redis_url`/`redis_max_connections` —
  no shared-config changes needed, just consuming what's already there.

No new AWS resources, no free-tier budget impact — this is entirely reusing
infrastructure that's already provisioned and paid for (nothing, since Redis is
self-hosted) but sitting idle.

## Explicitly out of scope for this pass

- **Semantic/fuzzy cache matching** (e.g. embedding-similarity lookup instead of exact
  normalized-text match) — real value for catching near-duplicate phrasings of the same
  question, but real complexity (needs a vector similarity search against cached keys,
  a similarity threshold to tune). Worth a follow-up once exact-match hit rate is
  measured and shows headroom for it.
- **Tier 2** (full first-turn response caching) — see above, deferred until Tier 1's
  actual hit rate justifies the added complexity.
- **Cross-session personalization awareness** — none of this changes based on who's
  asking; the cache is deliberately question-text-keyed, not session-keyed.

## Verification plan (once implemented)

- Unit tests for `cache_get`/`cache_set` mocking the redis client, plus a
  `retrieve_context` test asserting a second identical call doesn't hit Qdrant/OpenAI
  again (monkeypatch `embed_query`/the Qdrant client, assert single call count).
- A Redis-down integration test: point `REDIS_URL` at an unreachable host, assert
  `retrieve_context` still returns real results (proves the fail-open contract holds).
- Manual: hit the same question twice in the deployed environment, confirm the second
  turn's `retrieve` step latency in `make prod-logs` visibly drops, and `cache.hit`
  appears in the logs.

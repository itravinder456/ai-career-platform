# Redis Response Caching

**Status:** implemented (both tiers below). This document is the design record — read it
for the *why*, not as a proposal awaiting approval.

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

### Tier 2: cache the full `respond()` output — `app/core/response_cache.py`

Bigger win than Tier 1 — skips `plan_tasks`, every `execute_task`, *and* the final
`respond` LLM call entirely for a cache hit, all three model calls one chat turn costs,
not just the retrieval step.

The risk this needs to manage: `respond()` builds its answer from the full conversation
history, so the same question text can legitimately deserve a different answer
mid-conversation. The first design considered here (see git history) gated this on
conversation position — only cache the *first* message of a fresh session, checked via
`career_graph.aget_state()`. That was rejected: the sidebar's suggestion chips
(`frontend/src/lib/questions.ts` — "What's your tech stack?", "Tell me about yourself",
etc.) are clickable at *any* point in a chat, not just as someone's opening message, so
gating on position missed most of the real-world repeat-question pattern the whole
feature exists for.

**What's actually implemented instead**: gate on the question being long enough to be
self-contained, not on where it falls in the conversation —
`app/api/v1/run.py`'s `_is_cacheable_query`:

```python
MIN_CACHEABLE_WORDS = 4

def _is_cacheable_query(message: str) -> bool:
    return len(message.split()) >= MIN_CACHEABLE_WORDS
```

The reasoning: short prompts ("why?", "go on", "explain more") are exactly the ones most
likely to lean on whatever was just said — they're fragments, not questions. Real,
self-contained questions ("What's your tech stack?" — 4 words, "Tell me about
yourself" — 4 words) read the same regardless of when they're asked, which is what
actually makes reusing a cached answer for them safe. This is a knowingly imperfect
heuristic (a long question *can* still reference "that project" from three messages ago;
a short one is occasionally genuinely standalone) — accepted deliberately, since this is
a single-person portfolio site, not a system serving meaningfully different answers per
visitor. The threshold (4 words) is a judgment call, easy to retune in one place if it
turns out too loose or too strict in practice.

Both the *read* and the *write* are gated on `_is_cacheable_query` — a short prompt's
answer never populates the cache either, so it can't later get served (wrongly) as a
cached answer to someone else's short prompt.

**Conversation continuity on a hit**: even though the graph never runs, the turn still
needs to exist in that session's history for later follow-ups to have context. `_stream`
calls `career_graph.aupdate_state(config, {"messages": [HumanMessage(...),
AIMessage(...)]})` to inject the Q&A pair directly into the checkpointer — confirmed
against a real `InMemorySaver`-backed graph that this correctly appends to existing
history (or initializes it, for a fresh session) without executing any node. Wrapped in
try/except: if the history write fails, the user still got their (already-sent) answer,
just logged as `run.cache_hit.history_update_failed` rather than surfaced as an error.

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

## Infra wiring (done)

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

## Explicitly out of scope

- **Semantic/fuzzy cache matching** (e.g. embedding-similarity lookup instead of exact
  normalized-text match) — real value for catching near-duplicate phrasings of the same
  question, but real complexity (needs a vector similarity search against cached keys,
  a similarity threshold to tune). Worth a follow-up once exact-match hit rate is
  measured and shows headroom for it.
- **Cross-session personalization awareness** — none of this changes based on who's
  asking; the cache is deliberately question-text-keyed, not session-keyed.
- **Retuning `MIN_CACHEABLE_WORDS`** based on real hit-rate data — 4 was a reasonable
  starting judgment call, not a measured value. Revisit once `cache.hit`/`cache.miss`/
  `run.cache_hit` logs show real traffic patterns.

## Verification

- Unit tests: `tests/test_cache.py` (the low-level `cache_get`/`cache_set`, including a
  Redis-down case proving the fail-open contract), `tests/test_retrieval.py` (Tier 1 —
  a cache hit skips both the embedding call and the Qdrant call, a cache miss populates
  it, a retrieval failure is never cached), `tests/test_run.py` (Tier 2 — `_is_cacheable_query`'s
  word-count boundary, a cache hit skips the graph and still updates conversation
  history via `aupdate_state`, a cache miss runs the graph and populates the cache, a
  short prompt never touches the cache either way, an error is never cached).
- Manual, once deployed: ask the same *long* question (4+ words) twice in the same
  session — second time should return near-instantly, and `run.cache_hit` plus
  `cache.hit` should both appear in `make prod-logs`. Ask a short follow-up
  ("why?") and confirm it always goes through the real pipeline regardless of repetition.

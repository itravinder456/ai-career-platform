# Architecture

This describes the system as it's actually built and deployed today — not a plan, not
aspirational. See [PRODUCT_VISION.md](./PRODUCT_VISION.md) for the *why*, and
[LOCAL_SETUP.md](./LOCAL_SETUP.md) to run it.

## System overview

```
┌─────────────┐      SSE (JSON events)      ┌─────────────┐
│  Frontend    │ ───────────────────────────▶│  API        │
│  Next.js     │◀─────────────────────────── │  FastAPI    │
│  :3000       │                              │  :8000      │
└─────────────┘                              └──────┬──────┘
                                                      │ proxies, no local
                                                      │ session state
                                                      ▼
                                              ┌─────────────┐
                                              │  Runtime     │
                                              │  FastAPI +   │
                                              │  LangGraph   │
                                              │  :8001       │
                                              └──┬───┬───┬───┘
                                   ┌──────────────┘   │   └──────────────┐
                                   ▼                  ▼                  ▼
                            ┌──────────┐       ┌──────────┐       ┌──────────┐
                            │ Postgres  │       │  Qdrant   │       │  Redis    │
                            │ chat       │       │  RAG      │       │  response │
                            │ checkpoints│       │  vectors  │       │  cache    │
                            │ + career    │      │           │       │           │
                            │ facts       │      │           │       │           │
                            └──────────┘       └──────────┘       └──────────┘
                                   ▲                  ▲
                                   │ also read/         │ populated by
                                   │ written by          │
                            ┌──────┴──────┐      ┌───────┴────────┐
                            │  API         │      │  ingestion      │
                            │  (admin CRUD)│      │  (offline CLI)  │
                            │  profile /   │      └────────────────┘
                            │  projects /  │
                            │  experience /│
                            │  skills /    │
                            │  documents   │
                            └─────────────┘

services/ingestion — offline CLI, not a running service — reads projects/experiences/
skills/documents straight out of Postgres (the same tables services/api's admin panel
edits), chunks, embeds, upserts into Qdrant. Nothing else writes to Qdrant. The only file
still on disk under data/ is data/resume/*.pdf — raw bytes served as a download, entirely
separate from ingestion (see "Documents and the resume asset" below).
```

Four services, one shared internal Python package:

| Service | Stack | Role |
|---|---|---|
| `frontend/` | Next.js, TailwindCSS | Chat UI, landing page, admin panel |
| `services/api/` | FastAPI, asyncpg, redis-py | Public gateway — proxies chat to runtime over SSE, owns the `profile`/`social_links`/`profile_stats`/`projects`/`experiences`/`skills`/`documents` admin CRUD |
| `services/runtime/` | FastAPI, LangGraph, LangChain | The actual agent — planning, retrieval, response generation |
| `services/ingestion/` | Python CLI (uv-run, no server) | Offline pipeline: Postgres rows (`projects`/`experiences`/`skills`/`documents`) → chunks → embeddings → Qdrant |
| `shared/core/` | Python package (`ravinder-ai-core`) | One `AppSettings` class, structured logging, a shared `AppError` hierarchy, `AppModel` base — imported by `api`, `runtime`, and `ingestion` so there's no per-service config drift |

`services/api` never talks to Qdrant or holds conversation state — it's a thin, stateless
proxy. All conversation memory lives in `services/runtime`'s LangGraph checkpointer,
keyed by `session_id` as the LangGraph thread id.

## The agent: a planner–executor graph, not a single prompt

`services/runtime/app/graphs/career.py`:

```
START → plan_tasks → fan_out_tasks (Send × N) → execute_task (parallel) → respond → END
```

- **`plan_tasks`** — one LLM call decomposes the recruiter's message into 1–4 focused
  sub-tasks. A simple question ("what's your tech stack?") produces one task; a compound
  one ("what have you built, what's your stack, and are you a fit for this JD?") produces
  several.
- **`fan_out_tasks`** — dispatches one `execute_task` invocation per planned task via
  LangGraph's `Send` primitive, running them concurrently rather than in sequence.
- **`execute_task`** — each branch does RAG retrieval against Qdrant plus an inline
  sufficiency-check-and-retry, and fans back into a shared `results` list.
- **`respond`** — waits for every branch, makes the one LLM call that synthesizes
  everything into a single coherent answer, and extracts any `WIDGET:` blocks the model
  emitted (structured cards — `ProjectCard`, `TechStack`, `SkillGraph`,
  `ArchitectureCard`, `ResumePreview` — rendered inline in the chat).

No tool-calling is bound to any of these LLM calls. Retrieval already runs automatically
per task, so the base model has no need to call tools itself — real agentic tool-calling
(a sub-agent deciding its own actions) is deliberately deferred rather than bolted on
here. See [AGENT_PROMPT.md](./AGENT_PROMPT.md) for the next planned addition to this
graph — a clarifying-question branch that reuses the same `plan_tasks` call rather than
adding a new LLM node.

**Why planner–executor over one big prompt or a fixed multi-agent pipeline**: compound
recruiter questions are common enough that a single retrieval pass produces shallow
answers to the parts it wasn't tuned for. Fanning sub-tasks out in parallel keeps latency
close to a single-task turn while still giving each part of a compound question its own
focused retrieval. It's also cheap to extend — a new sub-task type doesn't need a new
graph node, just a new `intent` value the executor already knows how to route.

### LLM provider

`app/core/llm.py` is a small factory keyed on `LLM_PROVIDER` (`openai` | `groq` |
`anthropic` | `ollama`), defaulting to OpenAI (`gpt-4.1-mini`) — switching providers is an
env var change, not a code change. Same pattern for embeddings (`EMBEDDING_PROVIDER`).

### Conversation memory

The graph is compiled with `AsyncPostgresSaver` (`app/memory/checkpointer.py`) and
invoked with `thread_id = session_id`. LangGraph loads prior turns for that thread
automatically before running and persists the updated state after — callers only ever
send the newest message, never the full history.

### Caching (Redis, `app/core/cache.py`)

Two tiers, both fail-open (a Redis miss or outage always falls through to doing the real
work, never surfaces as a user-facing error):

1. **Retrieval cache** — `retrieve_context()` caches Qdrant search results by normalized
   query text. Same query, same nearest neighbors, no conversation-history risk.
2. **Full-response cache** (`app/core/response_cache.py`) — skips `plan_tasks`, every
   `execute_task`, and the final `respond` call entirely on a hit. Gated on the question
   being at least 4 words (`_is_cacheable_query`) — short fragments ("why?", "go on")
   almost always depend on whatever was just said, while longer questions
   ("what's your tech stack?") read the same regardless of when they're asked. A cache
   hit still writes the turn into the LangGraph checkpointer directly
   (`aupdate_state`) so follow-up questions keep working.

## Content model — Postgres is authored, Qdrant is derived

An earlier version drew this as two *independently authored* tracks: structured facts
in Postgres (`profile`/`social_links`/`profile_stats`) alongside free-form write-ups in
`data/projects/*.md` that `services/ingestion` chunked into Qdrant. `experiences`/
`projects`/`skills` briefly had their own Postgres tables too, but those were dropped —
the same facts also lived as prose in `data/`, and nothing forced the two copies to
match, so the structured side silently drifted out of sync with what RAG actually
served.

The current shape fixes that by making Qdrant **derived, not authored**: every table
below is admin-edited in Postgres, and `services/ingestion` builds the entire Qdrant
index by reading those same rows and serializing them into text — there is no second,
independently-edited copy of anything to drift.

**All structured/narrative content lives in Postgres** (Alembic-migrated,
`services/api/app/db/models/`), owned and edited through the admin panel (`/admin`,
gated by an `X-Admin-Key` header checked against `ADMIN_SECRET_KEY` via
`hmac.compare_digest`):

- `profile` / `social_links` / `profile_stats` — landing-page facts (name, headline,
  stats, links). Read publicly via `GET /api/v1/profile`; `services/runtime`'s
  system-prompt identity block reads the same table directly.
- `projects` / `experiences` / `skills` — real columns (`tech_stack`, `impact`,
  `achievements`, dates, etc.), not a prose blob. This is what lets `/projects`,
  `/experience`, and `/skills` render directly for anyone who'd rather browse than chat,
  and what a future resume-generator (filter/rank projects against a JD) needs to query —
  neither is possible against unstructured markdown without re-parsing it every time.
- `documents` — a generic `doc_type`/title/body table for content that doesn't need
  row-level structure: blog posts, certificates, and the resume's extracted text. Scoped
  admin writes (`PUT /api/v1/documents/{doc_type}`) so editing a blog post can't touch
  the resume row.

**`services/ingestion` turns those rows into a Qdrant index** — offline, manual
(`make ingest`), not a live read:

```
Postgres (projects / experiences / skills / documents)
        │  services/ingestion — offline, manual (`make ingest`)
        │  load rows → serialize to text → chunk → embed → upsert
        ▼
    Qdrant
        │  services/runtime — online, per chat request
        │  embed the query → semantic search → top-k chunks as LLM context
        ▼
   Chat response
```

Each table serializes differently: a `projects`/`experiences` row becomes one document
(name + description + tech stack + impact/achievements as one coherent chunk source);
all of `skills` collapses into a *single* synthetic document grouped by category, since
~30 near-identical one-line facts would otherwise dilute retrieval against each other
rather than reading as one coherent answer. `services/runtime` never reads Postgres's
content tables or `services/ingestion` directly at request time — it only ever queries
an already-populated Qdrant collection. If a row changes but `make ingest` hasn't re-run,
the chat simply won't know about the change yet — same staleness caveat as before, just
with a different source of truth underneath it.

**Documents and the resume asset**: `data/resume/*.pdf` is the one file still on disk —
raw PDF bytes served as a download by the frontend's `/resume` route (see
`frontend/src/app/resume/route.ts`), and separately re-uploadable through the admin
panel's Documents tab (`POST /api/v1/documents/resume/upload`), which extracts the text
into the `documents` row ingestion actually reads. That upload endpoint is a deliberate
stopgap: `api` and `frontend` are separate Docker images in production with no shared
volume for `data/` (see `infrastructure/docker/docker-compose.prod.yml`), so a file
written by `api` isn't visible to the deployed `frontend` container until that's
addressed — either a shared volume, or serving the PDF from `api` instead of `frontend`.
Fine for local dev today; flagged, not yet fixed, for production.

**Why Postgres for both structured and narrative content, with Qdrant purely derived**:
structured facts need to be fast and directly editable field-by-field, and (for
projects/experience/skills) filterable/rankable by a future consumer — Postgres is the
right tool for all of that. Semantic search over the resulting prose still needs a
vector store, but there's no reason that vector store's source should be authored
separately from the facts admin already maintains — deriving it removes the drift risk
entirely instead of just managing it.

## Streaming

`services/runtime`'s `/api/v1/run` streams raw SSE events (`step`, `token`, `widget`,
`done`, `error`) as the graph executes. `services/api`'s `/api/v1/chat` is a pure relay —
it re-emits each event as a typed Pydantic schema over its own SSE stream rather than
holding any state itself. The frontend's `streamChat()` client parses that stream and
updates the message list token-by-token.

## Deployment

Single free-tier AWS EC2 box (Amazon Linux, Docker Compose), fronted by Caddy for
automatic HTTPS (Let's Encrypt) on a real domain
(`infrastructure/docker/docker-compose.prod.yml`, `Caddyfile`):

```
Internet → Caddy (:80/:443, auto-TLS) → frontend :3000
                                       → /api/* → api :8000 → runtime :8001
```

- **Postgres** — AWS RDS free tier (external, not a container).
- **Qdrant** — Qdrant Cloud free tier (external, not a container).
- **Redis** — self-hosted in Docker on the box (session/response cache only; AWS
  ElastiCache isn't reliably free-tier).
- **`services/ingestion`** — not a long-running container. Run manually, on demand,
  whenever the knowledge base under `data/` changes.

`NEXT_PUBLIC_API_URL` is baked into the frontend's JS bundle at Docker build time (a
build ARG, not a runtime env var) — Next.js resolves `NEXT_PUBLIC_*` vars during
`next build`, not at container start.

## Rate limiting & input bounds

`POST /api/v1/chat` is the only route that fans out to a paid LLM call, so it's the
one that needs protecting from a single client running up cost:

- **Rate limiting** (`services/api/app/core/rate_limit.py`) — Redis-backed, fixed-window,
  keyed by client IP (read from `X-Forwarded-For`, which Caddy sets in production; falls
  back to the raw connection IP otherwise). Two independent windows both have to pass —
  a per-minute cap (default 20) catches a fast bot, a per-day cap (default 300) catches
  one that paces itself under that but keeps going all day. Like the response cache, it
  fails open on a Redis outage rather than blocking the entire chat over an infra hiccup.
- **Message length cap** — `ChatRequest.message` (and the runtime's own `RunRequest`, for
  defense in depth against a direct call that skips the gateway) is capped at 2000
  characters, rejected before it ever reaches the LLM.

Both are enforced only at `services/api`, the public boundary — `services/runtime` isn't
reachable from the internet.

## Notable tradeoffs

- **SSE, not WebSockets** — the model only ever streams server → client; SSE is simpler,
  reconnects automatically, and needs no extra protocol handling in Next.js.
- **Qdrant over Pinecone/Chroma** — free to self-host or use Qdrant Cloud's free tier,
  advanced filtering, no vendor lock-in.
- **LangGraph over a hand-rolled chain** — native support for the `Send`-based dynamic
  fan-out the planner–executor pattern needs; a linear chain can't express "N parallel
  sub-tasks decided at runtime" without significant custom plumbing.
- **No tool-calling yet** — see the planner–executor section above; deferred rather than
  half-implemented.

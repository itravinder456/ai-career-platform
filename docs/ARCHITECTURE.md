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
                            └──────────┘       └──────────┘       └──────────┘
                                   ▲
                                   │ also read by
                            ┌──────┴──────┐
                            │  API         │  profile / social links / stats
                            │  (admin CRUD)│
                            └─────────────┘

services/ingestion — offline CLI, not a running service — reads data/{resume,projects,
blogs,certificates}/, chunks, embeds, upserts into Qdrant. Nothing else writes to Qdrant.
```

Four services, one shared internal Python package:

| Service | Stack | Role |
|---|---|---|
| `frontend/` | Next.js, TailwindCSS | Chat UI, landing page, admin panel |
| `services/api/` | FastAPI, asyncpg, redis-py | Public gateway — proxies chat to runtime over SSE, owns the `profile`/`social_links`/`profile_stats` admin CRUD |
| `services/runtime/` | FastAPI, LangGraph, LangChain | The actual agent — planning, retrieval, response generation |
| `services/ingestion/` | Python CLI (uv-run, no server) | Offline pipeline: `data/` documents → chunks → embeddings → Qdrant |
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

## Content model — two independent tracks

Structured facts and narrative documents are deliberately **not** stored the same way:

**Track 1 — structured facts, Postgres.** `profile`, `social_links`, `profile_stats`
(Alembic-migrated, `services/api/app/db/models/`). Anything the UI needs to render
directly and predictably — the landing page's name, headline, stats, links. Owned and
edited through the admin panel (`/admin`, gated by an `X-Admin-Key` header checked
against `ADMIN_SECRET_KEY` via `hmac.compare_digest`), read publicly via
`GET /api/v1/profile`. `services/runtime`'s system-prompt identity block reads this same
table directly, so there's exactly one place that knows the platform owner's name,
location, and links.

An earlier version also gave `experiences`/`projects`/`skills` this same structured
CRUD treatment. That was removed — those are career *facts* already covered by Track 2's
RAG over the real resume/project write-ups, and a second structured copy risked drifting
out of sync with the source of truth every time only one side was updated.

**Track 2 — narrative documents, Qdrant via `services/ingestion`.** Free-form written
material — resume, project write-ups, blog posts, certificates — for the chat's
deep/narrative answers ("walk me through your architecture", "why did you choose X").
This is a two-stage pipeline, not a live read:

```
data/{resume,projects,blogs,certificates}/ (.md, .txt, .pdf)
        │  services/ingestion — offline, manual (`make ingest`)
        │  load → chunk → embed → upsert
        ▼
    Qdrant
        │  services/runtime — online, per chat request
        │  embed the query → semantic search → top-k chunks as LLM context
        ▼
   Chat response
```

`services/runtime` never reads `data/` directly and never talks to `services/ingestion`
at request time — it only ever queries an already-populated Qdrant collection. If a file
under `data/` is added or edited but `make ingest` hasn't re-run, the chat simply won't
know about the change yet.

**Why two tracks, not one**: structured facts need to be fast and directly editable
field-by-field — Postgres is the right tool. Narrative material needs semantic search
over unstructured prose — a vector store is the right tool. Making one serve both jobs
fights the grain of both.

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

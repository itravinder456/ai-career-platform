# API Service (`services/api`)

**Role in the flow:** the public gateway. Owns CORS, the public URL surface, infra health, **and**
the Postgres profile model (name/headline/links/hero stats) behind an admin-key gate — holds no
*conversation* state itself, that still lives entirely in `runtime`.

## What it does

Two responsibilities, cleanly separated:

1. **Chat proxy** — a thin FastAPI layer in front of `services/runtime`. It re-shapes and forwards
   the chat request, streams the runtime's SSE response back to the browser, and exposes `/health`
   for the three datastores. It does **not** run the LLM, does not classify intent, and does not
   store chat history — all of that lives in `runtime`.
2. **Profile API** — owns the `profile` and `social_links` tables (Alembic-migrated). `GET` is
   public (read by the landing page and by `runtime`'s system prompt); `PUT` requires
   `X-Admin-Key` matching `ADMIN_SECRET_KEY`, checked by `app/dependencies/auth.py`. The frontend's
   `/admin` page is the only consumer of the write side today.

Deliberately **not** here: `experiences`/`projects`/`skills` as structured, admin-edited tables.
An earlier pass built full CRUD for those, but career facts (what Ravinder actually built, worked
on, knows) come from RAG over `services/ingestion`'s `data/` documents — a second, structured copy
of the same facts was redundant and risked drifting out of sync with the real source of truth, so
it was removed. `profile`/`social_links`/`profile_stats` remain because they back the landing
page directly and have no RAG equivalent.

## Stack

FastAPI, `httpx` (proxying), SQLAlchemy async + `asyncpg` (profile model, not just health checks),
Alembic (migrations), `redis-py`, `qdrant-client`, `sse-starlette`.

## Structure

```
services/api/app/
├── main.py                 app factory: CORS, RequestLoggingMiddleware, exception handlers, router mount
├── core/lifespan.py        startup: verifies Postgres/redis/qdrant are reachable — never creates tables
├── clients/http.py         one shared httpx.AsyncClient per process (not per request)
├── api/v1/
│   ├── chat.py             POST /chat, POST /chat/clear — proxy to runtime
│   ├── health.py           GET /health
│   ├── admin.py            GET /admin/ping — validates X-Admin-Key with no side effects
│   └── profile.py          GET/PUT /profile — singleton row + social_links + profile_stats (replace-all on write)
├── db/
│   ├── {postgres,redis,qdrant}.py   client singletons, ensure_collection()
│   └── models/              Profile, SocialLink, ProfileStat (SQLAlchemy, see below)
├── schemas/profile.py        Pydantic request/response shapes
├── dependencies/
│   ├── auth.py              require_admin — compares X-Admin-Key against ADMIN_SECRET_KEY
│   └── db.py, settings.py   FastAPI Depends() wrappers
├── middleware/logging.py    structured request/response logging
└── alembic/                 migrations — versions/ has the schema history, including the
                              projects/experiences/skills tables' creation *and* later removal
```

## Content model — CRUD conventions

`Profile` is always exactly one row (`id=1`); `PUT /profile` patches whatever fields are provided
and, for `links`/`stats`, deletes and reinserts the entire `social_links`/`profile_stats` table if
that field is included. Right-sized for a handful of links and a handful of hero stats — this
replace-all shape doesn't scale to a growing collection (which is part of why `projects` etc.
were removed rather than kept as a second CRUD shape to maintain).

`PUT /profile` requires `Depends(require_admin)`; `GET /profile` has no auth. `NotFoundError`
(from `core.exceptions`) maps to `404` with a structured `{"error": {...}}` body via the shared
exception handlers.

## Flow — `POST /api/v1/chat`

```
1. Parse ChatRequest {session_id, message}
2. Open a streamed POST to runtime: POST {RUNTIME_URL}/api/v1/run {session_id, message}
     — no chat history attached; runtime's checkpointer owns that, keyed by session_id
3. Re-emit each runtime SSE line as a typed Pydantic model (SSEToken/SSEWidget/SSEDone/SSEError)
     via EventSourceResponse back to the browser
4. On runtime unreachable / non-200 / exception → yield a single SSEError, don't crash the stream
```

`POST /chat/clear` just proxies to `DELETE {RUNTIME_URL}/api/v1/run/{session_id}`, which tells the
checkpointer in `runtime` to drop that thread's saved state.

## Flow — `GET /health`

Independently pings Redis (`PING`), Postgres (`SELECT 1`), and Qdrant (`get_collections()`), each
in its own try/except so one failing dependency doesn't hide the others. Returns `200` if all pass,
`206` with a per-service status + exception string if any fail.

## Design tradeoffs

| Decision | Alternative considered | Why this way |
|---|---|---|
| **Thin proxy, zero session/history state in `api`** | Terminate chat history here (Redis-backed), pass full history to runtime each call | Keeps exactly one owner of conversation state (`runtime`'s LangGraph checkpointer). Two services independently tracking "what happened in this session" is a consistency bug waiting to happen — `api` restarting or scaling out would otherwise need shared session storage of its own. |
| **SSE (`EventSourceResponse`) re-emission, not raw byte passthrough** | Pipe runtime's raw stream bytes straight through | Re-parsing runtime's SSE lines into typed `SSE*` Pydantic models means the public contract (what shape events `api` promises the browser) is decoupled from runtime's internal event shape — runtime can add/rename internal event fields without breaking the frontend contract. Costs one extra JSON parse/serialize per line. |
| **`httpx.AsyncClient` as a process-lifetime singleton** (`clients/http.py`) | New client per request | Reuses the connection pool to `runtime` across every request — avoids a new TCP/TLS handshake per chat message. Safe because no per-request state (cookies/auth) is ever set on it. |
| **`init_db()` verifies connectivity only, never creates tables** | `Base.metadata.create_all()` on every startup | Alembic is the sole owner of schema. `create_all` on startup previously let any new SQLAlchemy model silently create its own table on next restart (with `--reload`, that's *every file save*), bypassing migrations and drifting out of sync with `alembic history` — this bit us once (`profile_stats` existed, empty, before its migration was even written). |
| **SSE over WebSockets** (shared platform-wide decision, `ARCHITECTURE.md` §10.2) | WebSockets | LLM streaming is server→client only; SSE has built-in reconnect, simpler infra (works through more proxies), and native Next.js/browser support without extra libraries. |

## Known gaps

- Redis client exists (`db/redis.py`) but isn't used for anything chat-related yet — connection-only.
- No rate limiting implemented yet despite `ARCHITECTURE.md`'s documented 10 req/min per IP plan.
- Admin auth is a single shared secret (`X-Admin-Key` == `ADMIN_SECRET_KEY`), not JWT/per-user —
  fine for a single-operator admin panel, would need real auth before adding a second admin user.
- No `documents` metadata table yet (see `ARCHITECTURE.md`'s Content & Document Architecture) —
  updating the resume or a project write-up is still a manual edit under `data/` + `make ingest`,
  not something the admin panel can do.

## Run & test

```bash
make dev-api     # starts postgres/redis/qdrant, then uvicorn --reload on :8000
make test        # includes services/api/tests (currently empty — no tests written yet)
```

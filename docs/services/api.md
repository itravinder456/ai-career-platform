# API Service (`services/api`)

**Role in the flow:** the public gateway. Owns CORS, the public URL surface, and infra health — holds no conversation state itself.

## What it does

A thin FastAPI proxy in front of `services/runtime`. It re-shapes and forwards the chat request, streams the runtime's SSE response back to the browser, and exposes `/health` for the three datastores. It does **not** run the LLM, does not classify intent, and does not store chat history — all of that lives in `runtime`.

## Stack

FastAPI, `httpx` (proxying), `asyncpg`/SQLAlchemy (health check only), `redis-py`, `qdrant-client`, `sse-starlette`.

## Structure

```
services/api/app/
├── main.py                 app factory: CORS, RequestLoggingMiddleware, exception handlers, router mount
├── core/lifespan.py        startup: init_db, redis, qdrant, http_client — each non-fatal if unreachable
├── clients/http.py         one shared httpx.AsyncClient per process (not per request)
├── api/v1/
│   ├── chat.py             POST /chat, POST /chat/clear
│   └── health.py           GET /health
├── db/{postgres,redis,qdrant}.py   client singletons, ensure_collection()
├── middleware/logging.py   structured request/response logging
├── schemas/chat.py         ChatRequest, SSEToken/SSEWidget/SSEDone/SSEError, SessionClearRequest
└── dependencies/           FastAPI Depends() wrappers for settings/db
```

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
| **Health check failures are non-fatal at startup** (`lifespan.py` wraps each in try/except) | Fail startup if Postgres/Redis/Qdrant unreachable | Lets `api` come up and serve `/health` (reporting the real per-service status) even if one dependency is briefly down — useful during local dev when you only start Qdrant, or before all containers in compose become healthy. |
| **SSE over WebSockets** (shared platform-wide decision, `ARCHITECTURE.md` §10.2) | WebSockets | LLM streaming is server→client only; SSE has built-in reconnect, simpler infra (works through more proxies), and native Next.js/browser support without extra libraries. |

## Known gaps

- Redis client exists (`db/redis.py`) but isn't used for anything chat-related yet — connection-only.
- No rate limiting implemented yet despite `ARCHITECTURE.md`'s documented 10 req/min per IP plan.
- No auth on `/admin/*` because there's no admin router yet (`services/api/app/routers/` is still `.gitkeep`).

## Run & test

```bash
make dev-api     # starts postgres/redis/qdrant, then uvicorn --reload on :8000
make test        # includes services/api/tests (currently empty — no tests written yet)
```

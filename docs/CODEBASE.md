# Codebase Flow

A request-by-request walkthrough of every service, from browser to LLM and back.

---

## Repository Layout

```
AI-Career-Platform/
├── frontend/               Next.js 16 chat UI
├── services/
│   ├── api/                FastAPI gateway (port 8000)
│   └── runtime/            LangGraph agent (port 8001, internal)
├── shared/
│   └── core/               Internal Python package — config, logging
├── infrastructure/
│   └── docker/             Per-service Dockerfiles
├── docker-compose.yml      Full local stack definition
└── Makefile                Dev workflow shortcuts
```

---

## Request Flow — Single Chat Turn

```
Browser
  │ POST /api/v1/chat  (JSON)
  ▼
services/api  (port 8000)
  │ validates request, proxies to runtime via SSE
  │ POST /api/v1/run  (JSON, internal)
  ▼
services/runtime  (port 8001)
  │ LangGraph career graph: classify → context → respond
  │ LLM call (Groq / Anthropic / Ollama)
  │ strips WIDGET block, emits token + widget SSE events
  ▼
services/api
  │ proxies SSE chunks upstream
  ▼
Browser
  reads SSE stream: { type: "token" } → { type: "widget"? } → { type: "done" }
```

---

## 1. Frontend (`frontend/`)

**Entry**: `src/app/page.tsx`  
Renders `<Hero>` (landing) or `<ChatWindow>` (chat) based on `AppState`.

### Chat flow

```
page.tsx
  └── ChatWindow.tsx
        ├── greeting effect — types out GREETING_TEXT locally (no backend)
        ├── send(input)
        │     ├── adds optimistic user + AI message to state
        │     └── streamChat(sessionId, input, callbacks)
        │           ├── POST /api/v1/chat  → ReadableStream
        │           ├── SSE parse loop
        │           │     onToken  → appends to AI message content
        │           │     onWidget → collects widget objects
        │           │     onDone   → marks message complete, attaches widgets
        │           └── onError  → shows error text in AI bubble
        ├── MessageBubble.tsx
        │     ├── MarkdownContent — parses **bold**, `code`, ordered/bullet lists
        │     └── WidgetRenderer → ProjectCard | SkillGraph | TechStack | …
        └── InputBar.tsx — auto-resize textarea, send on Enter
```

**Key files**:

| File | Purpose |
|------|---------|
| `src/services/chat.ts` | SSE client — `streamChat()`, `clearSession()` |
| `src/types/chat.ts` | `Message`, `Widget`, `AppState` types |
| `src/components/chat/MessageBubble.tsx` | Markdown renderer + bubble styles |
| `src/components/widgets/` | One component per widget type |
| `src/app/globals.css` | CSS vars, dot-grid, aurora/drift animations |

**Session persistence**: `sessionStorage["ai_session_id"]` — stable across page refreshes, cleared when the tab closes.

**React StrictMode**: The greeting effect uses a `cancelled` flag and resets all state in its cleanup so double-invocation restarts cleanly instead of freezing.

---

## 2. API Service (`services/api/`)

**Stack**: FastAPI + asyncpg + redis-py + qdrant-client + httpx

```
services/api/
├── app/
│   ├── main.py             app factory, CORS, middleware, router mount
│   ├── core/
│   │   └── lifespan.py     startup (init_db, redis, qdrant, http_client) — non-fatal if infra down
│   ├── clients/http.py     shared httpx.AsyncClient (one per process, not per request)
│   ├── api/v1/
│   │   ├── chat.py         POST /chat  →  proxy to runtime SSE (thin — no local session state)
│   │   │                   POST /chat/clear  →  proxies to runtime DELETE /run/{session_id}
│   │   └── health.py       GET /health  →  ping postgres + redis + qdrant
│   ├── db/
│   │   ├── postgres.py     asyncpg pool, init_db(), get_db()
│   │   ├── redis.py        redis.asyncio client, get_redis_client() — connection only, no chat use yet
│   │   └── qdrant.py       qdrant-client, ensure_collection()
│   ├── middleware/
│   │   └── logging.py      request/response structured logging
│   ├── schemas/chat.py     Pydantic request/response models
│   └── dependencies/       FastAPI Depends() wrappers for db/settings
```

Settings (`ApiSettings`) and exception handlers no longer live per-service — see
[Shared Core](#4-shared-core-sharedcore) below.

### Chat endpoint flow (`app/api/v1/chat.py`)

```python
POST /api/v1/chat
  1. Parse ChatRequest (session_id, message)
  2. POST to runtime /api/v1/run with {session_id, message} — no history attached
  3. Stream runtime response back to browser via EventSourceResponse

POST /api/v1/chat/clear
  1. Parse SessionClearRequest (session_id)
  2. DELETE runtime /api/v1/run/{session_id} — clears that thread's checkpoint
```

Conversation history lives entirely in runtime's LangGraph checkpointer (keyed by
`session_id` as the thread id) — `api` no longer reads or writes chat history itself.

### Health endpoint (`app/api/v1/health.py`)

Returns `200` if all three pass, `206 Degraded` if any fail — includes the actual exception string per service for easier debugging.

---

## 3. Runtime Service (`services/runtime/`)

**Stack**: FastAPI + LangGraph + LangChain (Groq / Anthropic / Ollama)

```
services/runtime/
├── app/
│   ├── main.py                 app factory; builds career_graph from the checkpointer at startup
│   ├── api/v1/run.py           POST /run  →  StreamingResponse (SSE)
│   │                           DELETE /run/{session_id}  →  clears that thread's checkpoint
│   ├── graphs/career.py        LangGraph career graph (build_career_graph(checkpointer))
│   ├── state/agent_state.py    TypedDict AgentState
│   ├── knowledge/profile.py    PROFILE, PROJECTS_DETAIL, SKILLS_DETAIL, …
│   └── memory/checkpointer.py  Postgres-backed AsyncPostgresSaver — conversation memory
```

### LangGraph career graph

```
START
  └── classify_intent
        reads user_input keywords → sets state["intent"]
        (project | skills | resume | jd_match | architecture | general)
  └── [intent node]  e.g. load_skills_context
        adds relevant KNOWLEDGE_BASE data to state["context"]
  └── respond
        builds system prompt = BASE_SYSTEM + context + WIDGET_INSTRUCTION
        calls LLM.ainvoke(messages)   — tools bound if TOOLS is non-empty
        parses "WIDGET:<type>:<json>" from output (only when there's no tool call)
        returns { messages: [ai_message], response: str, widgets: list[dict] }
  └── (tools_condition) ── tool_calls present ──> tools (ToolNode) ──> back to respond
                        └── no tool_calls ──> END
```

`TOOLS` in `graphs/career.py` is an empty list today — the respond ⇄ tools loop is scaffolded
so adding the first real tool is a one-line change (write it, append to `TOOLS`), not a graph
restructure.

### Conversation memory (`app/memory/checkpointer.py`)

The graph is compiled with `checkpointer=AsyncPostgresSaver(...)` and invoked with
`config={"configurable": {"thread_id": session_id}}`. LangGraph auto-loads prior turns for
that thread before running and saves the updated state after — the caller only sends the
new message, never the full history. `DELETE /run/{session_id}` calls
`checkpointer.adelete_thread(session_id)` to clear a conversation.

**Windows note**: `psycopg`'s async mode can't run on Windows' default `ProactorEventLoop`.
`run_dev.py` and the top of `app/main.py` set `WindowsSelectorEventLoopPolicy` before uvicorn
starts — a no-op on Linux/Docker. Use `python run_dev.py` for local dev on Windows, not a bare
`uvicorn app.main:app --reload`.

### SSE output sequence (`app/api/v1/run.py`)

```
await career_graph.ainvoke(initial_state, config={"configurable": {"thread_id": session_id}})
→ yield  { "type": "token",  "content": response_text }
→ yield  { "type": "widget", "widget_type": "skill_graph", "data": {...} }  (optional)
→ yield  { "type": "done" }
```

Using `ainvoke` instead of `astream_events` avoids WIDGET text leaking across
streamed chunks — Groq's character-level chunking can split `"WIDGET:"` across
multiple tokens, making it impossible to filter reliably mid-stream.

### LLM provider factory (`_build_llm`)

```python
LLM_PROVIDER=groq      → ChatGroq(model, api_key)
LLM_PROVIDER=anthropic → ChatAnthropic(model, api_key, max_tokens)
LLM_PROVIDER=ollama    → ChatOllama(model, base_url)
```

Switch providers by changing `LLM_PROVIDER` in `services/runtime/.env` — no code change.

---

## 4. Shared Core (`shared/core/`)

See [SHARED_LIBRARIES.md](./SHARED_LIBRARIES.md) for how to build and consume
internal packages with this pattern.

```
shared/core/
└── core/                  ← Python package name is "core"
    ├── config/
    │   ├── base.py        AppSettings — single settings class (all fields, all services) + get_settings()
    │   └── constants.py   non-secret default values
    ├── exceptions/
    │   ├── base.py         AppError hierarchy (NotFoundError, ValidationError, …)
    │   └── handlers.py     register_exception_handlers(app) — one error JSON shape for both services
    ├── logging/
    │   └── setup.py        configure_logging(), get_logger() — structlog + stdlib
    └── models/
        └── base.py         AppModel — Pydantic BaseModel with shared config
```

**How a service uses it**: there's no per-service settings file — every service imports the same
`AppSettings`/`get_settings` directly from `core.config`. Each field has a safe default, so a
service's `.env` only needs to set the vars it actually uses; anything else stays at its default,
and unknown keys in a `.env` are ignored.

```python
# services/api/app/core/lifespan.py
from core.config import get_settings

settings = get_settings()
settings.database_url   # set via services/api/.env
settings.runtime_url    # set via services/api/.env
```

Exception handling is the same pattern: `register_exception_handlers(app)` is called once in
each service's `main.py`, imported from `core.exceptions` — not reimplemented per service.

---

## Infrastructure

### docker-compose.yml — service startup order

```
postgres  (healthy check: pg_isready)
redis     (healthy check: redis-cli ping)
qdrant    (healthy check: curl http://localhost:6333/)
  ↓ depends_on (healthy)
runtime   (port 8001)
  ↓ depends_on (healthy)
api       (port 8000)
  ↓ depends_on (healthy)
frontend  (port 3000)
```

### Makefile targets

| Target | What it does |
|--------|-------------|
| `make install` | `uv sync` for both services + `npm install` |
| `make dev-infra` | Start postgres, redis, qdrant only |
| `make dev-api` | Run API with uvicorn --reload |
| `make dev-runtime` | Run runtime with uvicorn --reload |
| `make dev-frontend` | `npm run dev` |
| `make up` | Full Docker stack (build + start) |
| `make down` | Stop and remove containers |
| `make logs-api` | Tail API logs |
| `make logs-runtime` | Tail runtime logs |

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
│   │   ├── lifespan.py     startup (init_db, redis, qdrant) — non-fatal if infra down
│   │   └── settings.py     ApiSettings extends AppSettings from shared/core
│   ├── api/v1/
│   │   ├── chat.py         POST /chat  →  proxy to runtime SSE
│   │   │                   POST /chat/clear  →  clear session in Redis
│   │   └── health.py       GET /health  →  ping postgres + redis + qdrant
│   ├── db/
│   │   ├── postgres.py     asyncpg pool, init_db(), get_db()
│   │   ├── redis.py        redis.asyncio client, get_redis_client()
│   │   └── qdrant.py       qdrant-client, ensure_collection()
│   ├── middleware/
│   │   ├── logging.py      request/response structured logging
│   │   └── errors.py       global exception → JSON error response
│   ├── schemas/chat.py     Pydantic request/response models
│   └── dependencies/       FastAPI Depends() wrappers for db/settings
```

### Chat endpoint flow (`app/api/v1/chat.py`)

```python
POST /api/v1/chat
  1. Parse ChatRequest (session_id, message)
  2. Load history from Redis (last N turns as list[dict])
  3. POST to runtime /api/v1/run with {session_id, message, history}
  4. Stream runtime response back to browser via EventSourceResponse
  5. On done: append user + assistant turn to Redis session
```

### Health endpoint (`app/api/v1/health.py`)

Returns `200` if all three pass, `206 Degraded` if any fail — includes the actual exception string per service for easier debugging.

---

## 3. Runtime Service (`services/runtime/`)

**Stack**: FastAPI + LangGraph + LangChain (Groq / Anthropic / Ollama)

```
services/runtime/
├── app/
│   ├── main.py             app factory
│   ├── api/v1/run.py       POST /run  →  StreamingResponse (SSE)
│   ├── graphs/career.py    LangGraph career graph
│   ├── state/agent_state.py  TypedDict AgentState
│   ├── knowledge/profile.py  PROFILE, PROJECTS_DETAIL, SKILLS_DETAIL, …
│   └── memory/session.py   (placeholder — session history lives in API/Redis)
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
        calls LLM.ainvoke(messages)
        parses "WIDGET:<type>:<json>" from output
        returns { response: str, widgets: list[dict] }
END
```

### SSE output sequence (`app/api/v1/run.py`)

```
await career_graph.ainvoke(initial_state)   # single blocking LLM call
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
    │   ├── base.py        AppSettings — base Pydantic BaseSettings class
    │   └── groups/
    │       ├── database.py  DatabaseConfig mixin
    │       ├── redis.py     RedisConfig mixin
    │       ├── qdrant.py    QdrantConfig mixin
    │       ├── auth.py      AuthConfig mixin
    │       ├── llm.py       LlmConfig mixin (multi-provider)
    │       └── observability.py
    ├── logging/
    │   └── setup.py       configure_logging(), get_logger() — structlog
    └── models/
        └── base.py        AppModel — Pydantic BaseModel with shared config
```

**How a service uses it**:

```python
# services/api/app/core/settings.py
from core.config.base import AppSettings
from core.config.groups.database import DatabaseConfig
from core.config.groups.redis import RedisConfig

class ApiSettings(AppSettings, DatabaseConfig, RedisConfig):
    runtime_url: str = "http://localhost:8001"

@lru_cache
def get_settings() -> ApiSettings:
    return ApiSettings()
```

Each group mixin adds only its own fields (e.g. `DATABASE_URL`, `DB_POOL_SIZE`).
Services compose exactly the mixins they need.

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

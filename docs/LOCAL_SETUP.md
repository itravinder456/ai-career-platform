# Local Development Setup

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 18 | nodejs.org |
| Python | ≥ 3.12 | python.org |
| uv | latest | `pip install uv` |
| Docker + Compose | latest | docker.com |
| Git | any | git-scm.com |

---

## 1. Clone

```bash
git clone <repo-url>
cd AI-Career-Platform
```

---

## 2. Environment files

Copy each example and fill in real values:

```bash
cp services/api/.env.example       services/api/.env
cp services/runtime/.env.example   services/runtime/.env
cp services/ingestion/.env.example services/ingestion/.env
cp frontend/.env.example           frontend/.env.local
```

**`services/api/.env`** — minimum required:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/portfolio
REDIS_URL=redis://localhost:6379
QDRANT_URL=http://localhost:6333
RUNTIME_URL=http://localhost:8001
ADMIN_SECRET_KEY=<random-hex-32>   # python -c "import secrets; print(secrets.token_hex(32))"
```

**`services/runtime/.env`** — pick one LLM provider (defaults to `openai` if unset):
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini

# Or:
# LLM_PROVIDER=groq
# GROQ_API_KEY=gsk_...
# GROQ_MODEL=llama-3.3-70b-versatile

# LLM_PROVIDER=anthropic
# ANTHROPIC_API_KEY=sk-ant-...

# LLM_PROVIDER=ollama
# OLLAMA_BASE_URL=http://localhost:11434
# OLLAMA_MODEL=llama3.1

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/portfolio
REDIS_URL=redis://localhost:6379
QDRANT_URL=http://localhost:6333
```

**`services/ingestion/.env`** — needs an embedding provider (defaults to `openai`):
```env
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-...
QDRANT_URL=http://localhost:6333
```

**`frontend/.env.local`**:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 3. Start infrastructure

```bash
make dev-infra
# starts: postgres, redis, qdrant
```

Verify all three are healthy:
```bash
docker compose ps
```

---

## 4. Install dependencies

```bash
make install
# uv sync for api + runtime + ingestion + shared/core, npm install for frontend
```

---

## 5. Run services (three terminals)

```bash
# Terminal 1 — API gateway (port 8000)
make dev-api

# Terminal 2 — LangGraph runtime (port 8001)
make dev-runtime

# Terminal 3 — Next.js frontend (port 3000)
make dev-frontend
```

**Windows note**: `services/runtime` uses `psycopg`'s async mode, which can't run on
Windows' default `ProactorEventLoop`. `make dev-runtime` runs `run_dev.py`, which sets
`WindowsSelectorEventLoopPolicy` before starting uvicorn (a no-op on Linux/Docker) — don't
swap this for a bare `uvicorn app.main:app --reload` on Windows.

---

## 6. Ingest the knowledge base

Before the chat can answer anything grounded, Qdrant needs to actually have content in
it. Source content lives in Postgres now, not `data/` — add/edit `projects`,
`experiences`, `skills`, and `documents` (blog posts, certificates, resume text) through
the admin panel (`/admin`) or directly against those tables, then run:

```bash
make ingest
```

This is a one-off offline step, not something the running services trigger themselves —
re-run it any time those rows change. `data/resume/*.pdf` is the one exception: it's a
static asset served as a download by the frontend, unrelated to this step.

---

## 7. Verify

```bash
curl http://localhost:8000/health

curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"session_id": "test", "message": "What are your top skills?"}'
# → streams SSE events: token, widget?, done
```

---

## Service URLs

| Service | URL | Notes |
|---------|-----|-------|
| Frontend | http://localhost:3000 | Next.js chat UI |
| API | http://localhost:8000 | FastAPI gateway |
| API docs | http://localhost:8000/docs | Swagger |
| Runtime | http://localhost:8001 | LangGraph agent (internal) |
| Qdrant UI | http://localhost:6333/dashboard | Vector DB browser |

---

## Docker (full stack)

```bash
make up        # build + start all services
make logs      # tail all logs
make down      # stop + remove containers
```

---

## Shared core changes

After editing anything under `shared/core/`, reinstall it in every dependent service —
`uv` caches the built wheel, so plain `uv sync` won't pick up local changes:

```bash
make sync-core
```

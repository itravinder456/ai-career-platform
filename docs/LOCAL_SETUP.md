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

## 2. Environment Files

Copy each example and fill in real values:

```bash
cp services/api/.env.example    services/api/.env
cp services/runtime/.env.example services/runtime/.env
cp frontend/.env.example         frontend/.env.local
```

**`services/api/.env`** — minimum required:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/portfolio
REDIS_URL=redis://localhost:6379
QDRANT_URL=http://localhost:6333
RUNTIME_URL=http://localhost:8001
ADMIN_SECRET_KEY=<random-hex-32>   # python -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET=<random-hex-32>
```

**`services/runtime/.env`** — pick one LLM provider:
```env
LLM_PROVIDER=groq                  # groq | anthropic | ollama
GROQ_API_KEY=gsk_...               # free tier at console.groq.com
GROQ_MODEL=llama-3.3-70b-versatile

# ANTHROPIC_API_KEY=sk-ant-...
# LLM_PROVIDER=ollama
# OLLAMA_BASE_URL=http://localhost:11434
# OLLAMA_MODEL=llama3.1

REDIS_URL=redis://localhost:6379
QDRANT_URL=http://localhost:6333
```

**`frontend/.env.local`**:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 3. Start Infrastructure

```bash
make dev-infra
# starts: postgres, redis, qdrant  (docker-compose profiles)
```

Verify all three are healthy:
```bash
docker compose ps
# postgres, redis, qdrant should all show "healthy"
```

---

## 4. Install Dependencies

```bash
make install
# installs: uv sync for api + runtime + shared/core, npm install for frontend
```

---

## 5. Run Services (three terminals)

```bash
# Terminal 1 — API gateway (port 8000)
make dev-api

# Terminal 2 — LangGraph runtime (port 8001)
make dev-runtime

# Terminal 3 — Next.js frontend (port 3000)
make dev-frontend
```

---

## 6. Verify

```bash
# All infra + services healthy
curl http://localhost:8000/health

# Quick chat test
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

To run everything in containers:

```bash
make up        # build + start all services
make logs      # tail all logs
make down      # stop + remove containers
```

---

## Shared Core Changes

After editing anything under `shared/core/`, reinstall the package in both services:

```bash
uv sync --reinstall-package ravinder-ai-core --directory services/api
uv sync --reinstall-package ravinder-ai-core --directory services/runtime
```

This is required because uv caches the built wheel — the reinstall flag
forces a fresh build from the local path.

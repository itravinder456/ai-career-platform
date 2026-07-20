# AI Career Platform

An AI-powered portfolio where recruiters chat with an agent that actually knows the
underlying career history in depth — projects, technical decisions, skills — and answers
compound, specific questions instead of serving up a static resume.

Live: **https://ai.ravindervarikuppala.com**

---

## What is this?

Instead of scrolling a resume, a recruiter or hiring manager talks to an agent that:

- Answers questions about specific projects, technical decisions, and work history,
  grounded in real source documents via RAG — not generated from guesswork
- Breaks compound questions into sub-tasks and answers each part in parallel
  (`what have you built, what's your stack, and are you a fit for this JD?`)
- Renders structured widgets inline — project cards, tech stack, skill graph,
  architecture card — where a rich answer beats plain text

See [docs/PRODUCT_VISION.md](./docs/PRODUCT_VISION.md) for the why and the design
principles this holds itself to, and [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for
exactly how it's built.

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js, TailwindCSS |
| API gateway | FastAPI (thin SSE proxy, no local session state) |
| Agent runtime | FastAPI + LangGraph — planner–executor graph, `Send`-based parallel fan-out |
| LLM / embeddings | OpenAI (`gpt-4.1-mini` by default) — provider-swappable via env var |
| Vector store | Qdrant |
| Relational store | PostgreSQL — LangGraph conversation checkpoints + admin-edited profile data |
| Cache | Redis — retrieval cache + full-response cache |
| Deploy | Docker Compose on a single AWS EC2 box, Caddy for automatic HTTPS |

---

## Repository layout

```
├── frontend/           Next.js chat UI, landing page, admin panel
├── services/
│   ├── api/             FastAPI gateway (port 8000)
│   ├── runtime/          LangGraph agent (port 8001, internal)
│   └── ingestion/        RAG ingestion pipeline — CLI, run on demand
├── shared/core/         Shared Python package — config, logging, exceptions
├── infrastructure/docker/  Dockerfiles, prod Compose file, Caddyfile
├── data/                RAG source documents (resume, projects, blogs, certificates)
├── docker-compose.yml   Full local stack
└── docs/                Architecture, product vision, local setup
```

---

## Quick start

```bash
git clone <this-repo>
cd AI-Career-Platform
docker compose up -d
```

See [docs/LOCAL_SETUP.md](./docs/LOCAL_SETUP.md) for the full guide, including env vars
and running services outside Docker for faster iteration.

---

## Docs

- [docs/PRODUCT_VISION.md](./docs/PRODUCT_VISION.md) — what this is for, who it's for,
  design principles, where it's headed
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — the system as actually built: graph
  design, content model, caching, deployment topology, tradeoffs
- [docs/LOCAL_SETUP.md](./docs/LOCAL_SETUP.md) — running it locally
- [docs/AGENT_PROMPT.md](./docs/AGENT_PROMPT.md) — design doc for the next planned
  feature (clarifying questions), not yet implemented

---

## About

Built by **Varikuppala Ravinder**.

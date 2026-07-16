.PHONY: help install dev build up down restart logs clean \
        api-shell runtime-shell db-shell redis-shell \
        migrate test lint format sync-core

# ── Config ─────────────────────────────────────────────────────────────────────
DOCKER_COMPOSE := docker compose
UV := uv

# ── Help ───────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  AI Career Platform — available targets"
	@echo ""
	@echo "  Dev (local)"
	@echo "    make install         Install all Python + Node deps"
	@echo "    make sync-core       Reinstall shared/core into api + runtime after editing it"
	@echo "    make dev             Start infra (postgres/redis/qdrant) + run api & runtime locally"
	@echo "    make dev-frontend    Start the Next.js dev server"
	@echo ""
	@echo "  Docker"
	@echo "    make build           Build all Docker images"
	@echo "    make up              Start all services (detached)"
	@echo "    make down            Stop and remove containers"
	@echo "    make restart         down + up"
	@echo "    make logs            Tail all service logs"
	@echo "    make logs-api        Tail api logs"
	@echo "    make logs-runtime    Tail runtime logs"
	@echo "    make logs-frontend   Tail frontend logs"
	@echo ""
	@echo "  Database"
	@echo "    make migrate         Run Alembic migrations (TODO)"
	@echo "    make db-shell        psql into the postgres container"
	@echo "    make redis-shell     redis-cli into the redis container"
	@echo ""
	@echo "  Quality"
	@echo "    make test            Run all tests"
	@echo "    make lint            Run ruff + mypy"
	@echo "    make format          Run ruff format"
	@echo ""
	@echo "    make clean           Remove containers, volumes, and build artifacts"
	@echo ""

# ── Local install ──────────────────────────────────────────────────────────────
install: install-api install-runtime install-frontend

install-api:
	cd services/api && $(UV) sync

install-runtime:
	cd services/runtime && $(UV) sync

install-shared:
	cd shared/core && $(UV) sync

install-frontend:
	cd frontend && npm install

# uv path-deps aren't live-linked — after editing shared/core, force a reinstall
# in every service that depends on it, or changes silently won't take effect.
sync-core:
	cd services/api && $(UV) sync --reinstall-package ravinder-ai-core
	cd services/runtime && $(UV) sync --reinstall-package ravinder-ai-core

# ── Local dev (infra in Docker, services on host) ──────────────────────────────
dev-infra:
	$(DOCKER_COMPOSE) up -d postgres redis qdrant

dev-api: dev-infra
	cd services/api && $(UV) run uvicorn app.main:app --reload --port 8000

dev-runtime: dev-infra
	cd services/runtime && $(UV) run python run_dev.py

dev-frontend:
	cd frontend && npm run dev

# ── Docker ─────────────────────────────────────────────────────────────────────
build:
	$(DOCKER_COMPOSE) build

up:
	$(DOCKER_COMPOSE) up -d

down:
	$(DOCKER_COMPOSE) down

restart: down up

logs:
	$(DOCKER_COMPOSE) logs -f

logs-api:
	$(DOCKER_COMPOSE) logs -f api

logs-runtime:
	$(DOCKER_COMPOSE) logs -f runtime

logs-frontend:
	$(DOCKER_COMPOSE) logs -f frontend

# ── Shells ─────────────────────────────────────────────────────────────────────
api-shell:
	$(DOCKER_COMPOSE) exec api bash

runtime-shell:
	$(DOCKER_COMPOSE) exec runtime bash

db-shell:
	$(DOCKER_COMPOSE) exec postgres psql -U $${POSTGRES_USER:-postgres} $${POSTGRES_DB:-portfolio}

redis-shell:
	$(DOCKER_COMPOSE) exec redis redis-cli

# ── Database ───────────────────────────────────────────────────────────────────
migrate:
	cd services/api && $(UV) run alembic upgrade head

migrate-new:
	@read -p "Migration name: " name; \
	cd services/api && $(UV) run alembic revision --autogenerate -m "$$name"

# ── Quality ────────────────────────────────────────────────────────────────────
test:
	cd services/api && $(UV) run pytest tests/ -v
	cd services/runtime && $(UV) run pytest tests/ -v

lint:
	cd services/api && $(UV) run ruff check app/
	cd services/api && $(UV) run mypy app/
	cd services/runtime && $(UV) run ruff check app/
	cd services/runtime && $(UV) run mypy app/
	cd shared/core && $(UV) run ruff check core/
	cd frontend && npm run lint

format:
	cd services/api && $(UV) run ruff format app/
	cd services/runtime && $(UV) run ruff format app/
	cd shared/core && $(UV) run ruff format core/

# ── Clean ──────────────────────────────────────────────────────────────────────
clean:
	$(DOCKER_COMPOSE) down -v --remove-orphans
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .venv -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	cd frontend && rm -rf .next node_modules 2>/dev/null || true

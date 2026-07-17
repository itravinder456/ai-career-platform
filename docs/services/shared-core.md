# Shared Core (`shared/core`, package `ravinder-ai-core`)

**Role in the flow:** not part of the request path — it's the internal library every service
(`api`, `runtime`, `ingestion`) depends on for config, logging, exceptions, and base models, so
none of them reimplement the same plumbing three times.

## What it does

A single installable Python package, consumed via `uv` path-dependencies rather than published to
PyPI. Every service's `pyproject.toml` points at it with `ravinder-ai-core = { path = "../../shared/core" }`.

## Structure

```
shared/core/
├── pyproject.toml         name="ravinder-ai-core", hatchling build backend
└── core/                  the importable package — `from core.xxx import yyy`
    ├── config/
    │   ├── base.py         AppSettings — every field, every service, one class
    │   └── constants.py    non-secret defaults (model names, ports, TTLs — never credentials)
    ├── exceptions/
    │   ├── base.py          AppError hierarchy (NotFoundError, ValidationError, ConflictError, …)
    │   └── handlers.py      register_exception_handlers(app) — one error JSON shape everywhere
    ├── embeddings/
    │   └── factory.py       embed_texts()/embed_query()/close_embedder() — dispatches on
    │                        EMBEDDING_PROVIDER (openai|ollama), shared by ingestion + runtime
    ├── logging/setup.py     configure_logging(), get_logger() — structlog + stdlib bridge
    ├── models/base.py       AppModel, TimestampedModel, IdentifiedModel, PaginatedResponse
    ├── telemetry/setup.py   OpenTelemetry tracer setup, span() context manager
    └── utils/               retry, slugify, datetime helpers
```

## The single-`AppSettings` pattern

There is no `ApiSettings`/`RuntimeSettings`/`IngestionSettings` subclass. One `AppSettings` class
declares every field any service might ever need, each with a safe default and `extra="ignore"` on
the Pydantic `SettingsConfigDict`. A service's own `.env` only sets the variables *it* uses —
everything else silently stays at its default, and any unknown key in that `.env` is ignored
rather than erroring.

```python
# any service, same import
from core.config import get_settings
settings = get_settings()          # @lru_cache'd — one instance per process
settings.database_url              # only set if THIS service's .env sets DATABASE_URL
```

## Design tradeoffs

| Decision | Alternative considered | Why this way |
|---|---|---|
| **One `AppSettings` class for all services** | A settings base class per service, or a shared base + per-service subclass | Three services today, all early-stage — a single flat class is one file to scan for "every config value that exists anywhere," at the cost of it growing unbounded as services multiply. Revisit if it exceeds ~50 fields or services start needing genuinely conflicting field names. |
| **`extra="ignore"` on `SettingsConfigDict`** | `extra="forbid"` (fail on unknown env keys) | Lets one `.env.example` per service list only the vars that service cares about without every service's `.env` needing every field the shared class declares — the cost is a typo'd env var silently doing nothing instead of erroring at startup. |
| **`uv` path-dependency, not a private PyPI/Artifactory package** | Publish `ravinder-ai-core` to a private index | No publishing step, no version bump ceremony for internal changes — `uv sync --reinstall-package ravinder-ai-core` (`make sync-core`) picks up local edits immediately. Right tradeoff for a single-repo, single-maintainer project; would need to change if this package were ever consumed outside this monorepo. |
| **`hatchling` as the build backend** | `setuptools`, `poetry-core` (used by the *root* `pyproject.toml`, inconsistently) | Hatchling's `[tool.hatch.build.targets.wheel] packages = ["core"]` is a one-line way to map a bare `core/` directory into an installable wheel — no extra packaging config. |
| **`SecretStr` for every credential field** | Plain `str` | Prevents secrets from leaking into `repr()`/logs/tracebacks — `structlog` or an uncaught exception printing `settings` won't accidentally print an API key. |

## Known gaps

- **No `py.typed` marker in the package.** Any service running `mypy --strict` against code that
  imports from `core.*` gets `Skipping analyzing "core.xxx": module is installed, but missing
  library stubs or py.typed marker`, which cascades into `Class cannot subclass "AppModel" (has
  type "Any")` on every Pydantic model built on `AppModel`. Confirmed present in both
  `services/api` (`app/schemas/chat.py`) and `services/ingestion` today — not a new regression,
  just never fixed. Adding `shared/core/core/py.typed` would fix it, but surfaces a wave of
  unrelated latent type errors in consuming services' own code, so it's a deliberate separate task
  rather than a drive-by fix.
- `core/exceptions/handlers.py` originally imported `fastapi` at module scope, which broke any
  non-web consumer (`services/ingestion`, a plain CLI) with `ModuleNotFoundError: No module named
  'fastapi'` the moment it imported anything from `core` — `core/__init__.py` re-exports
  `register_exception_handlers`, so even `from core.models.base import AppModel` pulled in the
  whole exceptions module chain. Fixed by making the `fastapi` import lazy (inside the function,
  `TYPE_CHECKING`-guarded for the type hint) — worth remembering as the pattern for any future
  framework-specific code added to this package: shared/core is supposed to be framework-agnostic,
  so anything that needs FastAPI/a specific web framework must import it lazily, not at module
  scope. `core/embeddings/factory.py` follows the same rule for `openai`/`httpx` — both declared as
  real dependencies of `ravinder-ai-core`, but imported inside the provider functions, not at
  module top, and not re-exported from `core/__init__.py`.

## How to change it

See [SHARED_LIBRARIES.md](../SHARED_LIBRARIES.md) for the full walkthrough of adding a field or a
second internal package. Short version: edit `core/`, then `make sync-core` to reinstall the
built wheel into every consuming service's venv — `uv` doesn't live-link path dependencies.

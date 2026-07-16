# Building Internal Shared Libraries with uv

This document explains the pattern used by `shared/core` so you can
create additional internal packages (e.g. `shared/auth`, `shared/events`,
`shared/observability`) and consume them in any service.

---

## How It Works

Python packages are declared in `pyproject.toml` and built by a backend
(here: `hatchling`). `uv` supports **path dependencies** — instead of
publishing to PyPI, you point directly to a local directory.

```
monorepo/
├── shared/
│   └── core/          ← internal package: "ravinder-ai-core"
│       ├── pyproject.toml
│       └── core/      ← importable as `from core.xxx import yyy`
└── services/
    └── api/
        └── pyproject.toml   ← references shared/core via path dep
```

---

## Step 1 — Structure the Package

```
shared/core/
├── pyproject.toml
└── core/               ← Python package (must match [tool.hatch.build.targets.wheel].packages)
    ├── __init__.py
    ├── config/
    │   ├── __init__.py
    │   ├── base.py
    │   └── groups/
    │       ├── __init__.py
    │       ├── database.py
    │       └── redis.py
    └── logging/
        ├── __init__.py
        └── setup.py
```

---

## Step 2 — Write the Package `pyproject.toml`

```toml
# shared/core/pyproject.toml

[project]
name = "ravinder-ai-core"          # pip install name
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "pydantic>=2.7",
    "pydantic-settings>=2.2",
    "structlog>=24.1",
]

[tool.hatch.build.targets.wheel]
packages = ["core"]                # which directory to include

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

Key points:
- `name` is the install name you reference in consumer `pyproject.toml` files.
- `packages = ["core"]` maps the `core/` directory into the installed package.
- Imports in service code use `from core.xxx import yyy` — matching this directory name.

---

## Step 3 — Declare It as a Path Dependency in a Service

```toml
# services/api/pyproject.toml

[project]
name = "ravinder-ai-api"
dependencies = [
    "ravinder-ai-core @ ../../shared/core",   # path dep
    "fastapi>=0.139.0",
    "pydantic>=2.13.4",
]
```

The `@` syntax is PEP 440 direct references. The path is relative to
the consuming `pyproject.toml`.

---

## Step 4 — Install

```bash
cd services/api
uv sync
```

`uv` builds `shared/core` into a wheel at install time and adds it to
the service's virtual environment. You can verify:

```bash
uv pip show ravinder-ai-core
# Location: .venv/lib/python3.12/site-packages/core
```

---

## Step 5 — Import in Service Code

```python
# services/api/app/core/settings.py
from core.config.base import AppSettings
from core.config.groups.database import DatabaseConfig
from core.config.groups.redis import RedisConfig

class ApiSettings(AppSettings, DatabaseConfig, RedisConfig):
    runtime_url: str = "http://localhost:8001"
```

```python
# services/runtime/app/graphs/career.py
from core.logging.setup import get_logger

log = get_logger("runtime.graph")
```

---

## After Editing Shared Code

`uv` caches the built wheel. After any change to `shared/core/`, force
a reinstall in every service that depends on it:

```bash
uv sync --reinstall-package ravinder-ai-core --directory services/api
uv sync --reinstall-package ravinder-ai-core --directory services/runtime
```

Or via the Makefile shortcut if you add one:
```makefile
sync-core:
	uv sync --reinstall-package ravinder-ai-core --directory services/api
	uv sync --reinstall-package ravinder-ai-core --directory services/runtime
```

---

## Creating a Second Library (Example: `shared/auth`)

1. **Create directory structure**:
```bash
mkdir -p shared/auth/auth/{jwt,middleware}
touch shared/auth/auth/__init__.py
```

2. **Write `shared/auth/pyproject.toml`**:
```toml
[project]
name = "ravinder-ai-auth"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "pydantic>=2.7",
    "python-jose>=3.3",
    "ravinder-ai-core @ ../core",   # can depend on other internal packages
]

[tool.hatch.build.targets.wheel]
packages = ["auth"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

3. **Add to a service**:
```toml
# services/api/pyproject.toml
dependencies = [
    "ravinder-ai-core @ ../../shared/core",
    "ravinder-ai-auth @ ../../shared/auth",
    ...
]
```

4. **Import**:
```python
from auth.jwt import create_access_token, decode_token
```

---

## Design Rules for Internal Packages

| Rule | Reason |
|------|--------|
| No service-specific code in shared packages | Packages must be reusable across services |
| Secrets come from env, never hardcoded | Packages are version-controlled; .env files are not |
| Mixins over inheritance chains | Each group mixin is independently testable |
| `extra="ignore"` on BaseSettings | Services can have env vars the package doesn't know about |
| `SecretStr` for credentials | Prevents secrets appearing in logs or `__repr__` |

---

## Mixin Config Pattern (used in this project)

```python
# shared/core/core/config/groups/redis.py
from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings

class RedisConfig(BaseSettings):
    redis_url: SecretStr = Field(alias="REDIS_URL")
    redis_max_connections: int = Field(default=20)
    session_ttl_seconds: int = Field(default=7200)
```

```python
# shared/core/core/config/base.py
from pydantic_settings import BaseSettings

class AppSettings(BaseSettings):
    environment: str = Field(default="development")
    log_level: str = Field(default="INFO")

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",           # tolerate unknown env vars
        case_sensitive=False,
        populate_by_name=True,
    )
```

A service composes exactly what it needs:
```python
class ApiSettings(AppSettings, DatabaseConfig, RedisConfig, QdrantConfig, AuthConfig):
    runtime_url: str = Field(default="http://localhost:8001")
```

Pydantic's MRO linearisation merges all field definitions cleanly.

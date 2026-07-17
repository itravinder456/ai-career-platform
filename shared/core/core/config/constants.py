# Non-sensitive configuration constants.
# Secrets and credentials must NEVER appear here — they come from env / Secrets Manager.

# ── App ───────────────────────────────────────────────────────────────────────
APP_NAME = "ravinder-ai"
DEFAULT_ENVIRONMENT = "development"
DEFAULT_LOG_LEVEL = "INFO"
DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 8000

# ── LLM — model behaviour (not keys) ─────────────────────────────────────────
ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-5"
ANTHROPIC_MAX_TOKENS = 8096
ANTHROPIC_TEMPERATURE = 0.7

EMBEDDING_DEFAULT_PROVIDER = "openai"
EMBEDDING_DEFAULT_MODEL = "text-embedding-3-small"
EMBEDDING_VECTOR_SIZE = 1536

# ── Database — tuning only (no URLs/credentials) ─────────────────────────────
DB_POOL_SIZE = 10
DB_POOL_TIMEOUT = 30

# ── Redis — tuning only ───────────────────────────────────────────────────────
REDIS_MAX_CONNECTIONS = 20
SESSION_TTL_SECONDS = 7200  # 2 hours

# ── Qdrant — non-sensitive config ─────────────────────────────────────────────
DEFAULT_QDRANT_COLLECTION = "ravinder"

# ── Auth — algorithm config only (no secrets) ────────────────────────────────
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_MINUTES = 60

# ── Observability ─────────────────────────────────────────────────────────────
LANGSMITH_DEFAULT_PROJECT = "ravinder-ai"

# ── Agent ─────────────────────────────────────────────────────────────────────
AGENT_MAX_ITERATIONS = 10
AGENT_TIMEOUT_SECONDS = 30

# ── Internal services ─────────────────────────────────────────────────────────
DEFAULT_RUNTIME_URL = "http://localhost:8001"
DEFAULT_CORS_ORIGINS = ["http://localhost:3000"]

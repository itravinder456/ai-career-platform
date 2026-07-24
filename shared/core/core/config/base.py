from functools import lru_cache

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from core.config.constants import (
    AGENT_MAX_ITERATIONS,
    AGENT_TIMEOUT_SECONDS,
    ANTHROPIC_DEFAULT_MODEL,
    ANTHROPIC_MAX_TOKENS,
    ANTHROPIC_TEMPERATURE,
    APP_NAME,
    DB_POOL_SIZE,
    DB_POOL_TIMEOUT,
    DEFAULT_CORS_ORIGINS,
    DEFAULT_ENVIRONMENT,
    DEFAULT_HOST,
    DEFAULT_LLM_PROVIDER,
    DEFAULT_LOG_LEVEL,
    DEFAULT_PORT,
    DEFAULT_QDRANT_COLLECTION,
    DEFAULT_RUNTIME_URL,
    EMBEDDING_DEFAULT_MODEL,
    EMBEDDING_DEFAULT_PROVIDER,
    EMBEDDING_VECTOR_SIZE,
    JWT_ALGORITHM,
    JWT_EXPIRY_MINUTES,
    LANGSMITH_DEFAULT_PROJECT,
    OPENAI_DEFAULT_MODEL,
    RATE_LIMIT_PER_DAY,
    RATE_LIMIT_PER_MINUTE,
    REDIS_MAX_CONNECTIONS,
    SESSION_TTL_SECONDS,
)


class AppSettings(BaseSettings):
    """
    Single source of truth for configuration, shared by every service.
    Each service has its own .env and only sets the vars it needs —
    nothing here is required, so an unset var just keeps its default,
    and any key in a .env that isn't a field below is ignored.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        populate_by_name=True,
    )

    # ── App identity — set APP_NAME/PORT per service in its own .env ─────────
    app_name: str = Field(default=APP_NAME, alias="APP_NAME")
    environment: str = Field(default=DEFAULT_ENVIRONMENT, alias="ENVIRONMENT")
    debug: bool = Field(default=False, alias="DEBUG")
    log_level: str = Field(default=DEFAULT_LOG_LEVEL, alias="LOG_LEVEL")
    host: str = Field(default=DEFAULT_HOST, alias="HOST")
    port: int = Field(default=DEFAULT_PORT, alias="PORT")

    # ── Postgres (api) ─────────────────────────────────────────────────────
    database_url: SecretStr | None = Field(default=None, alias="DATABASE_URL")
    db_pool_size: int = Field(default=DB_POOL_SIZE, alias="DB_POOL_SIZE")
    db_pool_timeout: int = Field(default=DB_POOL_TIMEOUT, alias="DB_POOL_TIMEOUT")
    db_echo: bool = Field(default=False, alias="DB_ECHO")

    # ── Redis (api, runtime) ───────────────────────────────────────────────
    redis_url: SecretStr | None = Field(default=None, alias="REDIS_URL")
    redis_max_connections: int = Field(
        default=REDIS_MAX_CONNECTIONS, alias="REDIS_MAX_CONNECTIONS"
    )
    session_ttl_seconds: int = Field(
        default=SESSION_TTL_SECONDS, alias="SESSION_TTL_SECONDS"
    )
    # Two independent toggles, one per cache layer in services/runtime's chat flow —
    # see docs/OBSERVABILITY.md's caching section for the full picture:
    #   response_cache_enabled — the OUTER cache (app/core/response_cache.py). A hit
    #     skips the entire graph: plan_tasks, retrieval, execute_task, respond — all of
    #     it. Keyed on the raw user message only.
    #   rag_cache_enabled      — the INNER cache (app/tools/retrieval.py), only ever
    #     reached when the outer one misses. A hit skips just the Qdrant search.
    # Both off during eval/dev iteration so a re-ingested collection, a swapped
    # embedding provider, or a swapped LLM provider is felt on the very next query
    # instead of serving a stale cached turn or stale retrieved chunks.
    response_cache_enabled: bool = Field(default=True, alias="RESPONSE_CACHE_ENABLED")
    rag_cache_enabled: bool = Field(default=True, alias="RAG_CACHE_ENABLED")

    # ── Qdrant (api, runtime) ──────────────────────────────────────────────
    qdrant_url: str | None = Field(default=None, alias="QDRANT_URL")
    qdrant_api_key: SecretStr | None = Field(default=None, alias="QDRANT_API_KEY")
    qdrant_collection: str = Field(
        default=DEFAULT_QDRANT_COLLECTION, alias="QDRANT_COLLECTION"
    )
    qdrant_vector_size: int = Field(
        default=EMBEDDING_VECTOR_SIZE, alias="QDRANT_VECTOR_SIZE"
    )

    # ── Auth (api) ─────────────────────────────────────────────────────────
    admin_secret_key: SecretStr | None = Field(default=None, alias="ADMIN_SECRET_KEY")
    jwt_secret: SecretStr | None = Field(default=None, alias="JWT_SECRET")
    jwt_algorithm: str = Field(default=JWT_ALGORITHM, alias="JWT_ALGORITHM")
    jwt_expiry_minutes: int = Field(
        default=JWT_EXPIRY_MINUTES, alias="JWT_EXPIRY_MINUTES"
    )

    # ── LLM (runtime) ──────────────────────────────────────────────────────
    llm_provider: str = Field(default=DEFAULT_LLM_PROVIDER, alias="LLM_PROVIDER")
    openai_api_key: SecretStr | None = Field(default=None, alias="OPENAI_API_KEY")
    openai_model: str = Field(default=OPENAI_DEFAULT_MODEL, alias="OPENAI_MODEL")
    anthropic_api_key: SecretStr | None = Field(default=None, alias="ANTHROPIC_API_KEY")
    anthropic_model: str = Field(
        default=ANTHROPIC_DEFAULT_MODEL, alias="ANTHROPIC_MODEL"
    )
    anthropic_max_tokens: int = Field(
        default=ANTHROPIC_MAX_TOKENS, alias="ANTHROPIC_MAX_TOKENS"
    )
    anthropic_temperature: float = Field(
        default=ANTHROPIC_TEMPERATURE, alias="ANTHROPIC_TEMPERATURE"
    )
    groq_api_key: SecretStr | None = Field(default=None, alias="GROQ_API_KEY")
    groq_model: str = Field(default="llama-3.3-70b-versatile", alias="GROQ_MODEL")
    ollama_base_url: str = Field(
        default="http://localhost:11434", alias="OLLAMA_BASE_URL"
    )
    ollama_model: str = Field(default="llama3.2", alias="OLLAMA_MODEL")
    llm_temperature: float = Field(
        default=ANTHROPIC_TEMPERATURE, alias="LLM_TEMPERATURE"
    )
    llm_max_tokens: int = Field(default=ANTHROPIC_MAX_TOKENS, alias="LLM_MAX_TOKENS")
    embedding_provider: str = Field(
        default=EMBEDDING_DEFAULT_PROVIDER, alias="EMBEDDING_PROVIDER"
    )
    embedding_model: str = Field(
        default=EMBEDDING_DEFAULT_MODEL, alias="EMBEDDING_MODEL"
    )
    embedding_vector_size: int = Field(
        default=EMBEDDING_VECTOR_SIZE, alias="EMBEDDING_VECTOR_SIZE"
    )

    # ── Observability (api, runtime) ───────────────────────────────────────
    langsmith_api_key: SecretStr | None = Field(default=None, alias="LANGSMITH_API_KEY")
    langsmith_project: str = Field(
        default=LANGSMITH_DEFAULT_PROJECT, alias="LANGSMITH_PROJECT"
    )
    langsmith_tracing: bool = Field(default=False, alias="LANGSMITH_TRACING")
    otel_endpoint: str = Field(default="", alias="OTEL_ENDPOINT")
    otel_headers: str = Field(default="", alias="OTEL_HEADERS")
    otel_service_name: str = Field(default="", alias="OTEL_SERVICE_NAME")

    # ── API service ────────────────────────────────────────────────────────
    runtime_url: str = Field(default=DEFAULT_RUNTIME_URL, alias="RUNTIME_URL")
    cors_origins: list[str] = Field(
        default_factory=lambda: DEFAULT_CORS_ORIGINS, alias="CORS_ORIGINS"
    )

    # ── Rate limiting (api) — protects the public /chat endpoint's OpenAI/Qdrant/
    # Postgres cost from a single client. Two independent windows, both must pass.
    rate_limit_per_minute: int = Field(
        default=RATE_LIMIT_PER_MINUTE, alias="RATE_LIMIT_PER_MINUTE"
    )
    rate_limit_per_day: int = Field(
        default=RATE_LIMIT_PER_DAY, alias="RATE_LIMIT_PER_DAY"
    )

    # ── Runtime service ────────────────────────────────────────────────────
    max_iterations: int = Field(
        default=AGENT_MAX_ITERATIONS, alias="AGENT_MAX_ITERATIONS"
    )
    agent_timeout_seconds: int = Field(
        default=AGENT_TIMEOUT_SECONDS, alias="AGENT_TIMEOUT_SECONDS"
    )

    @field_validator("environment")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        allowed = {"development", "staging", "production"}
        if v not in allowed:
            raise ValueError(f"environment must be one of {allowed}, got '{v}'")
        return v

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        allowed = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        upper = v.upper()
        if upper not in allowed:
            raise ValueError(f"log_level must be one of {allowed}")
        return upper

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def is_development(self) -> bool:
        return self.environment == "development"


@lru_cache
def get_settings() -> AppSettings:
    return AppSettings()

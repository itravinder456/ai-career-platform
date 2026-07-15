from pydantic import Field

from core.config import AppSettings, make_settings_factory
from core.config.constants import DEFAULT_CORS_ORIGINS, DEFAULT_RUNTIME_URL
from core.config.groups import (
    AuthConfig,
    DatabaseConfig,
    ObservabilityConfig,
    QdrantConfig,
    RedisConfig,
)


class ApiSettings(
    AppSettings,
    DatabaseConfig,
    RedisConfig,
    QdrantConfig,
    AuthConfig,
    ObservabilityConfig,
):
    app_name: str = Field(default="ravinder-ai-api", alias="APP_NAME")
    runtime_url: str = Field(default=DEFAULT_RUNTIME_URL, alias="RUNTIME_URL")
    cors_origins: list[str] = Field(default=DEFAULT_CORS_ORIGINS, alias="CORS_ORIGINS")


get_settings = make_settings_factory(ApiSettings)

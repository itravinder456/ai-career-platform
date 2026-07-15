from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings

from core.config.constants import LANGSMITH_DEFAULT_PROJECT


class ObservabilityConfig(BaseSettings):
    # Optional — tracing is disabled by default
    langsmith_api_key: SecretStr | None = Field(default=None, alias="LANGSMITH_API_KEY")
    langsmith_project: str = Field(default=LANGSMITH_DEFAULT_PROJECT, alias="LANGSMITH_PROJECT")
    langsmith_tracing: bool = Field(default=False, alias="LANGSMITH_TRACING")

    # Non-sensitive
    otel_endpoint: str = Field(default="", alias="OTEL_ENDPOINT")
    otel_service_name: str = Field(default="", alias="OTEL_SERVICE_NAME")

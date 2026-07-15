from pydantic import Field

from core.config import AppSettings, make_settings_factory
from core.config.constants import AGENT_MAX_ITERATIONS, AGENT_TIMEOUT_SECONDS
from core.config.groups import LLMConfig, ObservabilityConfig, QdrantConfig, RedisConfig


class RuntimeSettings(
    AppSettings,
    LLMConfig,
    RedisConfig,
    QdrantConfig,
    ObservabilityConfig,
):
    app_name: str = Field(default="ravinder-ai-runtime", alias="APP_NAME")
    max_iterations: int = Field(default=AGENT_MAX_ITERATIONS, alias="AGENT_MAX_ITERATIONS")
    agent_timeout_seconds: int = Field(default=AGENT_TIMEOUT_SECONDS, alias="AGENT_TIMEOUT_SECONDS")


get_settings = make_settings_factory(RuntimeSettings)

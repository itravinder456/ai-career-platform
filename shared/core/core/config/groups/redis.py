from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings

from core.config.constants import REDIS_MAX_CONNECTIONS, SESSION_TTL_SECONDS


class RedisConfig(BaseSettings):
    # Required — URL may contain credentials in production
    redis_url: SecretStr = Field(alias="REDIS_URL")

    # Non-sensitive tuning
    redis_max_connections: int = Field(default=REDIS_MAX_CONNECTIONS, alias="REDIS_MAX_CONNECTIONS")
    session_ttl_seconds: int = Field(default=SESSION_TTL_SECONDS, alias="SESSION_TTL_SECONDS")

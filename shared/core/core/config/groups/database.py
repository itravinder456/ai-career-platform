from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings

from core.config.constants import DB_POOL_SIZE, DB_POOL_TIMEOUT


class DatabaseConfig(BaseSettings):
    # Required — must come from env / Secrets Manager
    database_url: SecretStr = Field(alias="DATABASE_URL")

    # Non-sensitive tuning
    db_pool_size: int = Field(default=DB_POOL_SIZE, alias="DB_POOL_SIZE")
    db_pool_timeout: int = Field(default=DB_POOL_TIMEOUT, alias="DB_POOL_TIMEOUT")
    db_echo: bool = Field(default=False, alias="DB_ECHO")

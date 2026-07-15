from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from core.config.constants import APP_NAME, DEFAULT_ENVIRONMENT, DEFAULT_LOG_LEVEL


class AppSettings(BaseSettings):
    """
    Identity-only base. Services compose groups on top of this.
    All env var definitions live in core.config.groups.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        populate_by_name=True,
    )

    app_name: str = Field(default=APP_NAME, alias="APP_NAME")
    environment: str = Field(default=DEFAULT_ENVIRONMENT, alias="ENVIRONMENT")
    debug: bool = Field(default=False, alias="DEBUG")
    log_level: str = Field(default=DEFAULT_LOG_LEVEL, alias="LOG_LEVEL")

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

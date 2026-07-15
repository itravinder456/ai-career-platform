from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings

from core.config.constants import JWT_ALGORITHM, JWT_EXPIRY_MINUTES


class AuthConfig(BaseSettings):
    # Required — must come from env / Secrets Manager
    admin_secret_key: SecretStr = Field(alias="ADMIN_SECRET_KEY")
    jwt_secret: SecretStr = Field(alias="JWT_SECRET")

    # Non-sensitive config
    jwt_algorithm: str = Field(default=JWT_ALGORITHM, alias="JWT_ALGORITHM")
    jwt_expiry_minutes: int = Field(default=JWT_EXPIRY_MINUTES, alias="JWT_EXPIRY_MINUTES")

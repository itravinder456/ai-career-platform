from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings

from core.config.constants import (
    ANTHROPIC_DEFAULT_MODEL,
    ANTHROPIC_MAX_TOKENS,
    ANTHROPIC_TEMPERATURE,
    EMBEDDING_DEFAULT_MODEL,
    EMBEDDING_VECTOR_SIZE,
)


class LLMConfig(BaseSettings):
    # Required
    anthropic_api_key: SecretStr = Field(alias="ANTHROPIC_API_KEY")

    # Non-sensitive model config
    anthropic_model: str = Field(default=ANTHROPIC_DEFAULT_MODEL, alias="ANTHROPIC_MODEL")
    anthropic_max_tokens: int = Field(default=ANTHROPIC_MAX_TOKENS, alias="ANTHROPIC_MAX_TOKENS")
    anthropic_temperature: float = Field(default=ANTHROPIC_TEMPERATURE, alias="ANTHROPIC_TEMPERATURE")

    embedding_model: str = Field(default=EMBEDDING_DEFAULT_MODEL, alias="EMBEDDING_MODEL")
    embedding_vector_size: int = Field(default=EMBEDDING_VECTOR_SIZE, alias="EMBEDDING_VECTOR_SIZE")

    # Optional — only if using OpenAI embeddings
    openai_api_key: SecretStr | None = Field(default=None, alias="OPENAI_API_KEY")

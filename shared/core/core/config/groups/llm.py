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
    # Which provider to use: anthropic | groq | ollama
    llm_provider: str = Field(default="groq", alias="LLM_PROVIDER")

    # Anthropic
    anthropic_api_key: SecretStr | None = Field(default=None, alias="ANTHROPIC_API_KEY")
    anthropic_model: str = Field(default=ANTHROPIC_DEFAULT_MODEL, alias="ANTHROPIC_MODEL")
    anthropic_max_tokens: int = Field(default=ANTHROPIC_MAX_TOKENS, alias="ANTHROPIC_MAX_TOKENS")
    anthropic_temperature: float = Field(default=ANTHROPIC_TEMPERATURE, alias="ANTHROPIC_TEMPERATURE")

    # Groq (free tier at console.groq.com)
    groq_api_key: SecretStr | None = Field(default=None, alias="GROQ_API_KEY")
    groq_model: str = Field(default="llama-3.3-70b-versatile", alias="GROQ_MODEL")

    # Ollama (local server)
    ollama_base_url: str = Field(default="http://localhost:11434", alias="OLLAMA_BASE_URL")
    ollama_model: str = Field(default="llama3.2", alias="OLLAMA_MODEL")

    # Shared
    llm_temperature: float = Field(default=ANTHROPIC_TEMPERATURE, alias="LLM_TEMPERATURE")
    llm_max_tokens: int = Field(default=ANTHROPIC_MAX_TOKENS, alias="LLM_MAX_TOKENS")

    # Embeddings
    embedding_model: str = Field(default=EMBEDDING_DEFAULT_MODEL, alias="EMBEDDING_MODEL")
    embedding_vector_size: int = Field(default=EMBEDDING_VECTOR_SIZE, alias="EMBEDDING_VECTOR_SIZE")

    # Optional — only if using OpenAI embeddings
    openai_api_key: SecretStr | None = Field(default=None, alias="OPENAI_API_KEY")

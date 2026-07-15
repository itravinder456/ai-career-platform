from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings

from core.config.constants import DEFAULT_QDRANT_COLLECTION, EMBEDDING_VECTOR_SIZE


class QdrantConfig(BaseSettings):
    # Required — must come from env
    qdrant_url: str = Field(alias="QDRANT_URL")

    # Optional — only needed for Qdrant Cloud
    qdrant_api_key: SecretStr | None = Field(default=None, alias="QDRANT_API_KEY")

    # Non-sensitive config
    qdrant_collection: str = Field(default=DEFAULT_QDRANT_COLLECTION, alias="QDRANT_COLLECTION")
    qdrant_vector_size: int = Field(default=EMBEDDING_VECTOR_SIZE, alias="QDRANT_VECTOR_SIZE")

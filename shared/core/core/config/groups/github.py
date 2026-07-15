from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings

from core.config.constants import GITHUB_API_URL, GITHUB_USERNAME


class GitHubConfig(BaseSettings):
    # Required
    github_token: SecretStr = Field(alias="GITHUB_TOKEN")

    # Non-sensitive
    github_username: str = Field(default=GITHUB_USERNAME, alias="GITHUB_USERNAME")
    github_api_url: str = Field(default=GITHUB_API_URL, alias="GITHUB_API_URL")

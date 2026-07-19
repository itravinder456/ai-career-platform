from pydantic import Field

from core.models.base import AppModel


class SocialLinkOut(AppModel):
    platform: str
    label: str
    url: str


class ProfileStatOut(AppModel):
    label: str
    value: str


class ProfileOut(AppModel):
    name: str
    headline: str
    location: str
    email: str
    summary: str | None
    resume_url: str
    links: list[SocialLinkOut]
    stats: list[ProfileStatOut]


class SocialLinkIn(AppModel):
    platform: str = Field(..., min_length=1, max_length=50)
    label: str = Field(..., min_length=1, max_length=100)
    url: str = Field(..., min_length=1, max_length=500)
    display_order: int = 0


class ProfileStatIn(AppModel):
    label: str = Field(..., min_length=1, max_length=100)
    value: str = Field(..., min_length=1, max_length=50)
    display_order: int = 0


class ProfileUpdate(AppModel):
    """All fields optional — only what's provided gets patched. `links`/`stats`,
    if provided, each replace their entire table (not merged)."""

    name: str | None = Field(default=None, max_length=200)
    headline: str | None = Field(default=None, max_length=200)
    location: str | None = Field(default=None, max_length=200)
    email: str | None = Field(default=None, max_length=200)
    summary: str | None = Field(default=None, max_length=2000)
    resume_url: str | None = Field(default=None, max_length=500)
    links: list[SocialLinkIn] | None = None
    stats: list[ProfileStatIn] | None = None

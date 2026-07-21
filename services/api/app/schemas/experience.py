from datetime import date

from pydantic import Field

from core.models.base import AppModel


class ExperienceOut(AppModel):
    id: int
    company: str
    title: str
    location: str | None
    start_date: date
    end_date: date | None
    summary: str | None
    achievements: list[str]
    tech_stack: list[str]
    display_order: int


class ExperienceIn(AppModel):
    company: str = Field(..., min_length=1, max_length=200)
    title: str = Field(..., min_length=1, max_length=200)
    location: str | None = Field(default=None, max_length=200)
    start_date: date
    end_date: date | None = None
    summary: str | None = Field(default=None, max_length=2000)
    achievements: list[str] = Field(default_factory=list)
    tech_stack: list[str] = Field(default_factory=list)
    display_order: int = 0


class ExperiencesUpdate(AppModel):
    experiences: list[ExperienceIn]

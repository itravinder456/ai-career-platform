from datetime import date

from pydantic import Field

from core.models.base import AppModel


class ProjectOut(AppModel):
    id: int
    slug: str
    name: str
    summary: str
    description: str | None
    tech_stack: list[str]
    impact: list[str]
    repo_url: str | None
    demo_url: str | None
    image_url: str | None
    status: str
    featured: bool
    start_date: date | None
    end_date: date | None
    display_order: int


class ProjectIn(AppModel):
    slug: str = Field(..., min_length=1, max_length=200)
    name: str = Field(..., min_length=1, max_length=200)
    summary: str = Field(..., min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=4000)
    tech_stack: list[str] = Field(default_factory=list)
    impact: list[str] = Field(default_factory=list)
    repo_url: str | None = None
    demo_url: str | None = None
    image_url: str | None = None
    status: str = "completed"
    featured: bool = False
    start_date: date | None = None
    end_date: date | None = None
    display_order: int = 0


class ProjectsUpdate(AppModel):
    """Whole-table replace, same convention as ProfileUpdate.links/stats."""

    projects: list[ProjectIn]

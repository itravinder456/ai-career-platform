from pydantic import Field

from core.models.base import AppModel


class SkillOut(AppModel):
    id: int
    name: str
    category: str
    proficiency: int | None
    display_order: int


class SkillIn(AppModel):
    name: str = Field(..., min_length=1, max_length=100)
    category: str = Field(..., min_length=1, max_length=50)
    proficiency: int | None = Field(default=None, ge=0, le=100)
    display_order: int = 0


class SkillsUpdate(AppModel):
    skills: list[SkillIn]

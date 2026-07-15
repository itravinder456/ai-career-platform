from datetime import datetime, timezone
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AppModel(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        use_enum_values=True,
        str_strip_whitespace=True,
    )


class TimestampedModel(AppModel):
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class IdentifiedModel(TimestampedModel):
    id: UUID = Field(default_factory=uuid4)


class PaginatedResponse(AppModel):
    items: list
    total: int
    page: int
    page_size: int

    @property
    def total_pages(self) -> int:
        return max(1, -(-self.total // self.page_size))  # ceiling division

    @property
    def has_next(self) -> bool:
        return self.page < self.total_pages

    @property
    def has_prev(self) -> bool:
        return self.page > 1

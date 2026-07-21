from datetime import date

from sqlalchemy import Boolean, Date, Integer, String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.base import TimestampMixin
from app.db.postgres import Base


class Project(Base, TimestampMixin):
    """Structured, admin-edited project facts — the sole source of truth (no
    parallel data/projects/*.md). Real columns, not a prose blob, so a future
    resume-generator can filter/rank on tech_stack, dates, impact directly."""

    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(200), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(String(4000), default=None)
    tech_stack: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    impact: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    repo_url: Mapped[str | None] = mapped_column(String(500), default=None)
    demo_url: Mapped[str | None] = mapped_column(String(500), default=None)
    image_url: Mapped[str | None] = mapped_column(String(500), default=None)
    status: Mapped[str] = mapped_column(String(50), default="completed")
    featured: Mapped[bool] = mapped_column(Boolean, default=False)
    start_date: Mapped[date | None] = mapped_column(Date, default=None)
    end_date: Mapped[date | None] = mapped_column(Date, default=None)
    display_order: Mapped[int] = mapped_column(Integer, default=0)

from datetime import date

from sqlalchemy import Date, Integer, String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.base import TimestampMixin
from app.db.postgres import Base


class Experience(Base, TimestampMixin):
    """Structured, admin-edited work-history facts — the sole source of truth.
    Not RAG'd from data/ prose today; ingestion serializes these rows into RAG
    text directly (see services/ingestion/app/loader.py)."""

    __tablename__ = "experiences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company: Mapped[str] = mapped_column(String(200))
    title: Mapped[str] = mapped_column(String(200))
    location: Mapped[str | None] = mapped_column(String(200), default=None)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date, default=None)
    summary: Mapped[str | None] = mapped_column(String(2000), default=None)
    achievements: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    tech_stack: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    display_order: Mapped[int] = mapped_column(Integer, default=0)

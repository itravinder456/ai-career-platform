"""
Postgres is the single source of truth for Ravinder's public profile data —
frontend, the public API, and the runtime's system prompt all read from these
tables instead of each hardcoding their own copy.
"""

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.base import TimestampMixin
from app.db.postgres import Base


class Profile(Base, TimestampMixin):
    """Singleton row (id=1) holding the person-level facts."""

    __tablename__ = "profile"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    headline: Mapped[str] = mapped_column(String(200))
    location: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str | None] = mapped_column(String(2000), default=None)
    resume_url: Mapped[str] = mapped_column(String(500))


class SocialLink(Base, TimestampMixin):
    __tablename__ = "social_links"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    platform: Mapped[str] = mapped_column(String(50))
    label: Mapped[str] = mapped_column(String(100))
    url: Mapped[str] = mapped_column(String(500))
    display_order: Mapped[int] = mapped_column(Integer, default=0)


class ProfileStat(Base, TimestampMixin):
    """Landing-page hero stats (e.g. '6+ / Years AI/ML') — a free-form ordered
    list, not fixed columns, so adding/removing/reordering a stat never needs a
    migration. See SocialLink above for the identical shape/rationale."""

    __tablename__ = "profile_stats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    label: Mapped[str] = mapped_column(String(100))
    value: Mapped[str] = mapped_column(String(50))
    display_order: Mapped[int] = mapped_column(Integer, default=0)

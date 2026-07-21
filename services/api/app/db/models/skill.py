from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.base import TimestampMixin
from app.db.postgres import Base


class Skill(Base, TimestampMixin):
    __tablename__ = "skills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100))
    category: Mapped[str] = mapped_column(String(50))
    # 0-100, nullable: an admin-entered fact, not an LLM guess. Only the public
    # /skills page's SkillGraph widget uses it — RAG text intentionally omits
    # it (see loader.py's skills serialization) so chat never quotes it as a
    # verified metric. Nullable so admins aren't forced to rate every skill.
    proficiency: Mapped[int | None] = mapped_column(Integer, default=None)
    display_order: Mapped[int] = mapped_column(Integer, default=0)

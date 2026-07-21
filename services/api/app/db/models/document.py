from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.base import TimestampMixin
from app.db.postgres import Base


class Document(Base, TimestampMixin):
    """Generic narrative content — blogs, certificates, and the resume's
    extracted text. No filter/rank use case (unlike Project/Experience/Skill),
    so this stays a title+body blob with a couple of metadata columns rather
    than getting its own rich schema."""

    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    doc_type: Mapped[str] = mapped_column(String(50))  # "resume" | "blog" | "certificate"
    title: Mapped[str] = mapped_column(String(300))
    body: Mapped[str] = mapped_column(Text)
    asset_url: Mapped[str | None] = mapped_column(String(500), default=None)
    display_order: Mapped[int] = mapped_column(Integer, default=0)

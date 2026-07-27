"""
Session-level metadata for chat conversations — deliberately separate from
the actual message history, which lives in services/runtime's LangGraph
checkpointer (same Postgres instance, different tables). This table only
tracks what the admin UI needs to list/browse sessions: no user name or IP,
per an explicit decision to keep this PII-free.
"""

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.base import TimestampMixin
from app.db.postgres import Base


class ChatSession(Base, TimestampMixin):
    __tablename__ = "chat_sessions"

    session_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    message_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    user_agent: Mapped[str | None] = mapped_column(String(500), default=None)
    first_message_preview: Mapped[str | None] = mapped_column(String(300), default=None)

from datetime import datetime
from typing import Any

from pydantic import Field

from core.models.base import AppModel


class ConversationOut(AppModel):
    session_id: str
    message_count: int
    user_agent: str | None
    first_message_preview: str | None
    created_at: datetime
    updated_at: datetime


class ConversationMessage(AppModel):
    role: str
    content: str
    widgets: list[dict[str, Any]] = Field(default_factory=list)


class ConversationDetailOut(ConversationOut):
    messages: list[ConversationMessage]

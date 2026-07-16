from typing import Any, Literal

from pydantic import Field

from core.models.base import AppModel


class ChatRequest(AppModel):
    session_id: str = Field(..., min_length=1, max_length=128)
    message: str = Field(..., min_length=1, max_length=8000)


class SessionClearRequest(AppModel):
    session_id: str = Field(..., min_length=1, max_length=128)


class WidgetPayload(AppModel):
    type: str
    data: dict[str, Any]


class ChatResponse(AppModel):
    session_id: str
    response: str
    widgets: list[WidgetPayload] = Field(default_factory=list)


# ── SSE event types sent to the frontend ──────────────────────────────────────

class SSEToken(AppModel):
    type: Literal["token"] = "token"
    content: str


class SSEWidget(AppModel):
    type: Literal["widget"] = "widget"
    widget_type: str
    data: dict[str, Any]


class SSEDone(AppModel):
    type: Literal["done"] = "done"
    session_id: str


class SSEError(AppModel):
    type: Literal["error"] = "error"
    message: str

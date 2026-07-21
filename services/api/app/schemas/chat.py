from typing import Any, Literal

from pydantic import ConfigDict, Field

from core.config.constants import CHAT_MESSAGE_MAX_LENGTH
from core.models.base import AppModel


class ChatRequest(AppModel):
    session_id: str = Field(..., min_length=1, max_length=128)
    # Capped well below what the LLM could handle — a recruiter question is a
    # sentence or two, not an essay; this bounds worst-case token cost per turn
    # and rejects obvious abuse before it reaches the runtime/LLM at all.
    message: str = Field(..., min_length=1, max_length=CHAT_MESSAGE_MAX_LENGTH)


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

class SSEStep(AppModel):
    type: Literal["step"] = "step"
    id: str
    label: str
    status: str


class SSEToken(AppModel):
    # AppModel's str_strip_whitespace=True is right for user-submitted fields (see
    # ChatRequest above) but wrong here: `content` is a raw streamed token delta where
    # a leading/trailing space is semantically significant (a word boundary) — a
    # space-only token would otherwise be silently stripped to "", vanishing entirely
    # and jamming words together on the client.
    model_config = ConfigDict(str_strip_whitespace=False)

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

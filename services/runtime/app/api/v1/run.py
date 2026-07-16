"""
POST /api/v1/run — internal endpoint called by services/api.
Accepts session history + user message, runs the LangGraph career graph,
streams tokens and widget events back via SSE.
"""

import json
from collections.abc import AsyncGenerator
from typing import Any

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, HumanMessage
from pydantic import Field

from app.core.logging import log
from app.graphs.career import career_graph
from app.state.agent_state import AgentState
from core.models.base import AppModel

router = APIRouter()


class RunRequest(AppModel):
    session_id: str = Field(..., min_length=1)
    history: list[dict[str, Any]] = Field(default_factory=list)
    message: str = Field(..., min_length=1)


@router.post("/run")
async def run(body: RunRequest) -> StreamingResponse:
    return StreamingResponse(
        _stream(body),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def _history_to_messages(history: list[dict[str, Any]]) -> list[HumanMessage | AIMessage]:
    msgs: list[HumanMessage | AIMessage] = []
    for item in history:
        role = item.get("role", "")
        content = item.get("content", "")
        if role == "user":
            msgs.append(HumanMessage(content=content))
        elif role == "assistant":
            msgs.append(AIMessage(content=content))
    return msgs


async def _stream(body: RunRequest) -> AsyncGenerator[str, None]:
    log.info("run.start", session_id=body.session_id, message_preview=body.message[:80])

    initial_state: AgentState = {
        "messages": _history_to_messages(body.history),
        "session_id": body.session_id,
        "user_input": body.message,
        "intent": "general",
        "context": {},
        "response": "",
        "widgets": [],
    }

    try:
        # Run graph to completion — respond node strips WIDGET from response_text
        # and stores it in state["widgets"]. We then emit clean text + widgets.
        final_state: AgentState = await career_graph.ainvoke(initial_state)

        response_text = final_state.get("response", "")
        if response_text:
            yield _sse({"type": "token", "content": response_text})

        for widget in final_state.get("widgets", []):
            yield _sse(widget)

        yield _sse({"type": "done"})
        log.info("run.done", session_id=body.session_id)

    except Exception as exc:
        log.exception("run.error", session_id=body.session_id, error=str(exc))
        yield _sse({"type": "error", "message": "Agent encountered an error. Please try again."})

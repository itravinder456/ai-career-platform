"""
POST   /api/v1/run             — internal endpoint called by services/api.
                                  Streams the LangGraph career graph for one turn over SSE:
                                  step events (progress), token events (incremental answer),
                                  an optional widget event, then done. History is loaded/saved
                                  automatically by the checkpointer, keyed by session_id.
DELETE /api/v1/run/{session_id} — clears that conversation's checkpoint state.
"""

import json
from collections.abc import AsyncGenerator
from typing import Any

from fastapi import APIRouter, Request, Response
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage
from pydantic import Field

from app.state.agent_state import AgentState
from app.streaming import TokenWidgetSplitter
from core.logging.setup import get_logger
from core.models.base import AppModel

log = get_logger(__name__)
router = APIRouter()


class RunRequest(AppModel):
    session_id: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1)


@router.post("/run")
async def run(body: RunRequest, request: Request) -> StreamingResponse:
    return StreamingResponse(
        _stream(body, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.delete("/run/{session_id}", status_code=204)
async def clear_run(session_id: str, request: Request) -> Response:
    checkpointer = request.app.state.checkpointer
    await checkpointer.adelete_thread(session_id)
    log.info("run.cleared", session_id=session_id)
    return Response(status_code=204)


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def _normalize_content(content: Any) -> str:
    """LLM chunk content is usually a str delta, but some providers (e.g. Anthropic)
    stream a list of content blocks — join their text parts."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            part.get("text", "") if isinstance(part, dict) else str(part) for part in content
        )
    return ""


async def _stream(body: RunRequest, request: Request) -> AsyncGenerator[str, None]:
    log.info("run.start", session_id=body.session_id, message_preview=body.message[:80])

    career_graph = request.app.state.career_graph

    # Only the new turn goes in — the checkpointer loads prior messages for this
    # thread_id and merges this HumanMessage in via the add_messages reducer.
    initial_state: AgentState = {
        "messages": [HumanMessage(content=body.message)],
        "session_id": body.session_id,
        "user_input": body.message,
        "intent": "general",
        "context": {},
        "response": "",
        "widgets": [],
    }
    config = {"configurable": {"thread_id": body.session_id}}
    splitter = TokenWidgetSplitter()

    try:
        # "custom" carries emit_step() progress events; "messages" carries LLM token
        # deltas. Only the respond node's tokens are the user-facing answer.
        async for mode, payload in career_graph.astream(
            initial_state, config=config, stream_mode=["messages", "custom"]
        ):
            if mode == "custom":
                yield _sse(payload)
            elif mode == "messages":
                chunk, meta = payload
                if meta.get("langgraph_node") != "respond":
                    continue
                emit = splitter.feed(_normalize_content(chunk.content))
                if emit:
                    yield _sse({"type": "token", "content": emit})

        trailing, widget = splitter.finish()
        if trailing:
            yield _sse({"type": "token", "content": trailing})
        if widget:
            yield _sse(widget)

        yield _sse({"type": "done"})
        log.info("run.done", session_id=body.session_id)

    except Exception as exc:
        log.exception("run.error", session_id=body.session_id, error=str(exc))
        yield _sse(
            {
                "type": "error",
                "message": "Agent encountered an error. Please try again.",
            }
        )

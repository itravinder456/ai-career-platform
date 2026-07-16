"""
POST   /api/v1/run             — internal endpoint called by services/api.
                                  Runs the LangGraph career graph for one turn,
                                  streams tokens and widget events back via SSE.
                                  Conversation history is loaded/saved automatically
                                  by the graph's checkpointer, keyed by session_id.
DELETE /api/v1/run/{session_id} — clears that conversation's checkpoint state.
"""

import json
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Request, Response
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage
from pydantic import Field

from app.state.agent_state import AgentState
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


async def _stream(body: RunRequest, request: Request) -> AsyncGenerator[str, None]:
    log.info("run.start", session_id=body.session_id, message_preview=body.message[:80])

    career_graph = request.app.state.career_graph

    # Only the new turn goes in — the checkpointer loads prior messages for
    # this thread_id and merges this HumanMessage in via the add_messages reducer.
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

    try:
        # Run graph to completion — respond node strips WIDGET from response_text
        # and stores it in state["widgets"]. We then emit clean text + widgets.
        final_state: AgentState = await career_graph.ainvoke(initial_state, config=config)

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

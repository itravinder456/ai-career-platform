"""
POST   /api/v1/run             — internal endpoint called by services/api.
                                  Streams the LangGraph career graph for one turn over SSE:
                                  step events (progress), token events (incremental answer),
                                  zero or more widget events, then done. History is loaded/saved
                                  automatically by the checkpointer, keyed by session_id.
                                  A repeated question can skip the graph entirely — see
                                  app.core.response_cache — but only when it's the FIRST
                                  message of a fresh session: the same question text mid-
                                  conversation can legitimately deserve a different answer
                                  once there's prior context, so the cache is never
                                  consulted (read OR write) once a session has any history.
DELETE /api/v1/run/{session_id} — clears that conversation's checkpoint state.
"""

import json
from collections.abc import AsyncGenerator
from typing import Any

from fastapi import APIRouter, Request, Response
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, HumanMessage
from pydantic import Field

from app.core.response_cache import get_cached_turn, set_cached_turn
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


async def _is_fresh_session(career_graph: Any, config: dict) -> bool:
    """True iff this session's checkpoint has no prior messages — the only case where
    reusing a cached full answer is safe, since there's no earlier conversation turn it
    could contradict or ignore."""
    try:
        snapshot = await career_graph.aget_state(config)
    except Exception as exc:
        log.warning("run.session_state_check_failed", error=str(exc))
        return False  # fail closed: skip the response cache rather than risk it
    return not snapshot.values.get("messages")


async def _stream(body: RunRequest, request: Request) -> AsyncGenerator[str, None]:
    log.info("run.start", session_id=body.session_id, message_preview=body.message[:80])

    career_graph = request.app.state.career_graph
    config = {"configurable": {"thread_id": body.session_id}}
    fresh_session = await _is_fresh_session(career_graph, config)

    cached = await get_cached_turn(body.message) if fresh_session else None
    if cached is not None:
        response_text, widgets = cached
        log.info("run.cache_hit", session_id=body.session_id)

        yield _sse({"type": "token", "content": response_text})
        for widget in widgets:
            yield _sse(widget)
        yield _sse({"type": "done"})

        # Record the turn in this session's history even though the graph never ran,
        # so a follow-up question still has this Q&A as context — same effect a real
        # graph run would have had on the checkpointer, at no LLM/retrieval cost.
        try:
            await career_graph.aupdate_state(
                config,
                {
                    "messages": [
                        HumanMessage(content=body.message),
                        AIMessage(content=response_text),
                    ]
                },
            )
        except Exception as exc:
            log.warning("run.cache_hit.history_update_failed", error=str(exc))
        return

    # Only the new turn goes in — the checkpointer loads prior messages for this
    # thread_id and merges this HumanMessage in via the add_messages reducer.
    initial_state: AgentState = {
        "messages": [HumanMessage(content=body.message)],
        "session_id": body.session_id,
        "user_input": body.message,
        "tasks": [],
        "results": [],
        "response": "",
        "widgets": [],
    }
    splitter = TokenWidgetSplitter()
    full_response_parts: list[str] = []

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
                    full_response_parts.append(emit)
                    yield _sse({"type": "token", "content": emit})

        trailing, widgets = splitter.finish()
        if trailing:
            full_response_parts.append(trailing)
            yield _sse({"type": "token", "content": trailing})
        for widget in widgets:
            yield _sse(widget)

        yield _sse({"type": "done"})
        log.info("run.done", session_id=body.session_id)

        if fresh_session:
            await set_cached_turn(body.message, "".join(full_response_parts), widgets)

    except Exception as exc:
        log.exception("run.error", session_id=body.session_id, error=str(exc))
        yield _sse(
            {
                "type": "error",
                "message": "Agent encountered an error. Please try again.",
            }
        )

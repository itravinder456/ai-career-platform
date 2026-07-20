"""
POST   /api/v1/run             — internal endpoint called by services/api.
                                  Streams the LangGraph career graph for one turn over SSE:
                                  step events (progress), token events (incremental answer),
                                  zero or more widget events, then done. History is loaded/saved
                                  automatically by the checkpointer, keyed by session_id.
                                  A repeated question can skip the graph entirely — see
                                  app.core.response_cache — gated on the question being
                                  long enough to be self-contained (see
                                  _is_cacheable_query / MIN_CACHEABLE_WORDS below), not on
                                  conversation position, so the sidebar's suggestion chips
                                  benefit from this even when clicked mid-chat.
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


MIN_CACHEABLE_WORDS = 4  # see docs/CACHING.md


def _is_cacheable_query(message: str) -> bool:
    """Short prompts ("why?", "go on", "explain more") are exactly the ones most likely
    to lean on whatever was just said in the conversation. Real, self-contained
    questions ("What's your tech stack?", "Tell me about yourself") read the same
    regardless of when they're asked, which is what actually makes reusing a cached
    answer for them safe — a word-count floor is a simpler and more useful signal for
    that than conversation position was, and it means the sidebar's suggestion chips
    benefit from this even when clicked mid-chat, not just as someone's first message."""
    return len(message.split()) >= MIN_CACHEABLE_WORDS


async def _stream(body: RunRequest, request: Request) -> AsyncGenerator[str, None]:
    log.info("run.start", session_id=body.session_id, message_preview=body.message[:80])

    career_graph = request.app.state.career_graph
    config = {"configurable": {"thread_id": body.session_id}}
    cacheable = _is_cacheable_query(body.message)

    cached = await get_cached_turn(body.message) if cacheable else None
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

        if cacheable:
            await set_cached_turn(body.message, "".join(full_response_parts), widgets)

    except Exception as exc:
        log.exception("run.error", session_id=body.session_id, error=str(exc))
        yield _sse(
            {
                "type": "error",
                "message": "Agent encountered an error. Please try again.",
            }
        )

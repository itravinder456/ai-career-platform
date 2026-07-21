import json
from collections.abc import AsyncGenerator

import httpx
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse

from app.clients.http import get_http_client
from app.dependencies.rate_limit import RateLimit
from app.dependencies.settings import Settings
from app.schemas.chat import (
    ChatRequest,
    SessionClearRequest,
    SSEDone,
    SSEError,
    SSEStep,
    SSEToken,
    SSEWidget,
)
from core.logging.setup import get_logger

log = get_logger(__name__)
router = APIRouter()


@router.post("/chat")
async def chat(body: ChatRequest, settings: Settings, _rate_limit: RateLimit) -> StreamingResponse:
    """
    Accepts a chat message and streams the runtime's SSE response back to the
    client token-by-token. Conversation history lives entirely in runtime's
    LangGraph checkpointer (keyed by session_id) — this is just a proxy.

    Rate-limited per client (see app.dependencies.rate_limit) — this is the only
    route that fans out to a paid LLM call, so it's the one that needs protecting
    from a single client running up cost.
    """
    return EventSourceResponse(
        _stream(body, settings),
        media_type="text/event-stream",
    )


@router.post("/chat/clear", status_code=204)
async def clear_session(body: SessionClearRequest, settings: Settings) -> None:
    client = get_http_client()
    await client.delete(f"{settings.runtime_url}/api/v1/run/{body.session_id}")


async def _stream(body: ChatRequest, settings: Settings) -> AsyncGenerator[str, None]:
    session_id = body.session_id

    runtime_payload = {
        "session_id": session_id,
        "message": body.message,
    }

    try:
        client = get_http_client()
        async with client.stream(
            "POST",
            f"{settings.runtime_url}/api/v1/run",
            json=runtime_payload,
        ) as response:
            if response.status_code != 200:
                error_body = await response.aread()
                log.error("runtime.error", status=response.status_code, body=error_body.decode())
                yield SSEError(message="Runtime service error").model_dump_json()
                return

            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                raw = line[5:].strip()
                if not raw:
                    continue

                try:
                    event = json.loads(raw)
                except json.JSONDecodeError:
                    continue

                event_type = event.get("type")

                if event_type == "step":
                    yield SSEStep(
                        id=event.get("id", ""),
                        label=event.get("label", ""),
                        status=event.get("status", "running"),
                    ).model_dump_json()

                elif event_type == "token":
                    content = event.get("content", "")
                    yield SSEToken(content=content).model_dump_json()

                elif event_type == "widget":
                    yield SSEWidget(
                        widget_type=event.get("widget_type", ""),
                        data=event.get("data", {}),
                    ).model_dump_json()

                elif event_type == "done":
                    break

                elif event_type == "error":
                    yield SSEError(message=event.get("message", "Unknown error")).model_dump_json()
                    return

    except httpx.ConnectError:
        log.error("runtime.unreachable", url=settings.runtime_url)
        yield SSEError(message="AI runtime is not reachable. Please try again.").model_dump_json()
        return
    except Exception as exc:
        log.exception("chat.stream.error", error=str(exc))
        yield SSEError(message="Unexpected error during streaming.").model_dump_json()
        return

    yield SSEDone(session_id=session_id).model_dump_json()

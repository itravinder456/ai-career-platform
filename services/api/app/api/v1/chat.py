import json
import uuid
from collections.abc import AsyncGenerator

import httpx
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse

from app.core.logging import log
from app.db.redis import get_session, set_session
from app.dependencies.settings import Settings
from app.schemas.chat import ChatRequest, SSEDone, SSEError, SSEToken, SSEWidget, SessionClearRequest

router = APIRouter()


@router.post("/chat")
async def chat(body: ChatRequest, settings: Settings) -> StreamingResponse:
    """
    Accepts a chat message, fetches session history from Redis,
    streams the runtime's SSE response back to the client token-by-token.
    """
    return EventSourceResponse(
        _stream(body, settings),
        media_type="text/event-stream",
    )


@router.post("/chat/clear", status_code=204)
async def clear_session(body: SessionClearRequest) -> None:
    from app.db.redis import delete_session
    await delete_session(body.session_id)


async def _stream(body: ChatRequest, settings: Settings) -> AsyncGenerator[str, None]:
    session_id = body.session_id
    history = await get_session(session_id)

    runtime_payload = {
        "session_id": session_id,
        "history": history,
        "message": body.message,
    }

    accumulated_response = ""
    widgets: list[dict] = []

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
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

                    if event_type == "token":
                        content = event.get("content", "")
                        accumulated_response += content
                        yield SSEToken(content=content).model_dump_json()

                    elif event_type == "widget":
                        widgets.append(event)
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

    # Persist updated history to Redis
    new_history = history + [
        {"role": "user", "content": body.message},
        {"role": "assistant", "content": accumulated_response},
    ]
    await set_session(session_id, new_history)

    yield SSEDone(session_id=session_id).model_dump_json()

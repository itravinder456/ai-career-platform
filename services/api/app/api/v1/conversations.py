import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.clients.http import get_http_client
from app.db.models import ChatSession
from app.dependencies.auth import require_admin
from app.dependencies.db import DB
from app.dependencies.settings import Settings
from app.schemas.conversation import ConversationDetailOut, ConversationMessage, ConversationOut
from core.exceptions.base import NotFoundError, UpstreamError

router = APIRouter()

# No pagination yet — traffic scale doesn't need it; add limit/offset if this
# ever grows past a screenful.
MAX_CONVERSATIONS = 200


def _to_out(row: ChatSession) -> ConversationOut:
    return ConversationOut(
        session_id=row.session_id,
        message_count=row.message_count,
        user_agent=row.user_agent,
        first_message_preview=row.first_message_preview,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.get(
    "/admin/conversations",
    response_model=list[ConversationOut],
    dependencies=[Depends(require_admin)],
)
async def list_conversations(db: DB) -> list[ConversationOut]:
    stmt = select(ChatSession).order_by(ChatSession.updated_at.desc()).limit(MAX_CONVERSATIONS)
    rows = await db.scalars(stmt)
    return [_to_out(r) for r in rows]


@router.get(
    "/admin/conversations/{session_id}",
    response_model=ConversationDetailOut,
    dependencies=[Depends(require_admin)],
)
async def get_conversation(session_id: str, db: DB, settings: Settings) -> ConversationDetailOut:
    row = await db.get(ChatSession, session_id)
    if row is None:
        raise NotFoundError(resource="Conversation")

    client = get_http_client()
    try:
        resp = await client.get(f"{settings.runtime_url}/api/v1/run/{session_id}/history")
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise UpstreamError(service="runtime") from exc
    messages = [ConversationMessage(**m) for m in resp.json()]

    out = _to_out(row)
    return ConversationDetailOut(**out.model_dump(), messages=messages)

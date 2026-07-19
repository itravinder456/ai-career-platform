from fastapi import APIRouter, Depends

from app.dependencies.auth import require_admin

router = APIRouter()


@router.get("/admin/ping", dependencies=[Depends(require_admin)])
async def admin_ping() -> dict:
    """Used by the admin UI purely to validate a key before showing the rest of
    the page — no side effects."""
    return {"ok": True}

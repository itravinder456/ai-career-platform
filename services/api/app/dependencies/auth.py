import hmac
from typing import Annotated

from fastapi import Header

from app.dependencies.settings import Settings
from core.exceptions.base import UnauthorizedError


async def require_admin(
    settings: Settings,
    x_admin_key: Annotated[str | None, Header(alias="X-Admin-Key")] = None,
) -> None:
    expected = settings.admin_secret_key
    if expected is None:
        raise UnauthorizedError(message="Admin endpoint is not configured")
    if not x_admin_key or not hmac.compare_digest(x_admin_key, expected.get_secret_value()):
        raise UnauthorizedError(message="Invalid admin key")

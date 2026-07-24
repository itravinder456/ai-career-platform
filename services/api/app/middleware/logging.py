import time
import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from core.logging.setup import get_logger

log = get_logger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = str(uuid.uuid4())[:8]
        start = time.perf_counter()

        with structlog.contextvars.bound_contextvars(request_id=request_id):
            log.info("request.start", method=request.method, path=request.url.path)

            response = await call_next(request)
            duration_ms = round((time.perf_counter() - start) * 1000, 1)

            log.info(
                "request.end",
                method=request.method,
                path=request.url.path,
                status=response.status_code,
                duration_ms=duration_ms,
            )

        response.headers["X-Request-ID"] = request_id
        return response

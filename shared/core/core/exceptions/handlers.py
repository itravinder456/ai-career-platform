from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from core.exceptions.base import AppError, ValidationError
from core.logging.setup import get_logger

log = get_logger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    """
    Single source of the error response shape: {"error": {"code", "message", "details"}}.
    Every failure mode (app-raised, request validation, unhandled) is normalized to an
    AppError first, so the JSON body is always built by AppError.to_dict() — never by hand.
    """

    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        log.warning("app.error", code=exc.code, message=exc.message, path=request.url.path)
        return JSONResponse(status_code=exc.http_status, content=exc.to_dict())

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        error = ValidationError(message="Invalid request", details={"errors": exc.errors()})
        log.warning("validation.error", path=request.url.path, errors=exc.errors())
        return JSONResponse(status_code=error.http_status, content=error.to_dict())

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled.error", path=request.url.path, error=str(exc))
        error = AppError(message="An unexpected error occurred.")
        return JSONResponse(status_code=error.http_status, content=error.to_dict())

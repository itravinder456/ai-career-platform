from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from core.exceptions.base import AppError
from core.logging.setup import get_logger

log = get_logger("api.errors")


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        log.warning(
            "app.error",
            code=exc.code,
            message=exc.message,
            path=request.url.path,
        )
        return JSONResponse(status_code=exc.http_status, content=exc.to_dict())

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled.error", path=request.url.path, error=str(exc))
        return JSONResponse(
            status_code=500,
            content={"code": "INTERNAL_ERROR", "message": "An unexpected error occurred."},
        )

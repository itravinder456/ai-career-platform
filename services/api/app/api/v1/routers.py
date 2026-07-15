from fastapi import FastAPI
from app.api.v1 import health, chat


def register_routers(app: FastAPI) -> None:
    app.include_router(health.router, prefix="/api/v1", tags=["health"])
    app.include_router(chat.router, prefix="/api/v1", tags=["chat"])


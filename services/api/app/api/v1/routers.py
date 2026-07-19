from fastapi import FastAPI
from app.api.v1 import admin, chat, health, profile


def register_routers(app: FastAPI) -> None:
    app.include_router(health.router, prefix="/api/v1", tags=["health"])
    app.include_router(chat.router, prefix="/api/v1", tags=["chat"])
    app.include_router(profile.router, prefix="/api/v1", tags=["profile"])
    app.include_router(admin.router, prefix="/api/v1", tags=["admin"])

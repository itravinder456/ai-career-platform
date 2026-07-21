from fastapi import FastAPI
from app.api.v1 import admin, chat, documents, experiences, health, profile, projects, skills


def register_routers(app: FastAPI) -> None:
    app.include_router(health.router, prefix="/api/v1", tags=["health"])
    app.include_router(chat.router, prefix="/api/v1", tags=["chat"])
    app.include_router(profile.router, prefix="/api/v1", tags=["profile"])
    app.include_router(projects.router, prefix="/api/v1", tags=["projects"])
    app.include_router(experiences.router, prefix="/api/v1", tags=["experiences"])
    app.include_router(skills.router, prefix="/api/v1", tags=["skills"])
    app.include_router(documents.router, prefix="/api/v1", tags=["documents"])
    app.include_router(admin.router, prefix="/api/v1", tags=["admin"])

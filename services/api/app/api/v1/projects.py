from fastapi import APIRouter, Depends
from sqlalchemy import delete, select

from app.db.models import Project
from app.dependencies.auth import require_admin
from app.dependencies.db import DB
from app.schemas.project import ProjectOut, ProjectsUpdate
from core.logging.setup import get_logger

log = get_logger(__name__)
router = APIRouter()


def _to_out(p: Project) -> ProjectOut:
    return ProjectOut(
        id=p.id,
        slug=p.slug,
        name=p.name,
        summary=p.summary,
        description=p.description,
        tech_stack=p.tech_stack,
        impact=p.impact,
        repo_url=p.repo_url,
        demo_url=p.demo_url,
        image_url=p.image_url,
        status=p.status,
        featured=p.featured,
        start_date=p.start_date,
        end_date=p.end_date,
        display_order=p.display_order,
    )


@router.get("/projects", response_model=list[ProjectOut])
async def list_projects(db: DB) -> list[ProjectOut]:
    rows = await db.scalars(select(Project).order_by(Project.display_order))
    return [_to_out(p) for p in rows]


@router.put("/projects", response_model=list[ProjectOut], dependencies=[Depends(require_admin)])
async def update_projects(body: ProjectsUpdate, db: DB) -> list[ProjectOut]:
    await db.execute(delete(Project))
    for p in body.projects:
        db.add(Project(**p.model_dump()))
    await db.flush()
    log.info("projects.updated", count=len(body.projects))
    rows = await db.scalars(select(Project).order_by(Project.display_order))
    return [_to_out(p) for p in rows]

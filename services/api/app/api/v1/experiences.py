from fastapi import APIRouter, Depends
from sqlalchemy import delete, select

from app.db.models import Experience
from app.dependencies.auth import require_admin
from app.dependencies.db import DB
from app.schemas.experience import ExperienceOut, ExperiencesUpdate
from core.logging.setup import get_logger

log = get_logger(__name__)
router = APIRouter()


def _to_out(e: Experience) -> ExperienceOut:
    return ExperienceOut(
        id=e.id,
        company=e.company,
        title=e.title,
        location=e.location,
        start_date=e.start_date,
        end_date=e.end_date,
        summary=e.summary,
        achievements=e.achievements,
        tech_stack=e.tech_stack,
        display_order=e.display_order,
    )


@router.get("/experiences", response_model=list[ExperienceOut])
async def list_experiences(db: DB) -> list[ExperienceOut]:
    rows = await db.scalars(select(Experience).order_by(Experience.display_order))
    return [_to_out(e) for e in rows]


@router.put("/experiences", response_model=list[ExperienceOut], dependencies=[Depends(require_admin)])
async def update_experiences(body: ExperiencesUpdate, db: DB) -> list[ExperienceOut]:
    await db.execute(delete(Experience))
    for e in body.experiences:
        db.add(Experience(**e.model_dump()))
    await db.flush()
    log.info("experiences.updated", count=len(body.experiences))
    rows = await db.scalars(select(Experience).order_by(Experience.display_order))
    return [_to_out(e) for e in rows]

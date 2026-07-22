from fastapi import APIRouter, Depends
from sqlalchemy import delete, select

from app.db.models import Skill
from app.dependencies.auth import require_admin
from app.dependencies.db import DB
from app.schemas.skill import SkillOut, SkillsUpdate
from core.logging.setup import get_logger

log = get_logger(__name__)
router = APIRouter()


def _to_out(s: Skill) -> SkillOut:
    return SkillOut(
        id=s.id,
        name=s.name,
        category=s.category,
        proficiency=s.proficiency,
        display_order=s.display_order,
    )


@router.get("/skills", response_model=list[SkillOut])
async def list_skills(db: DB) -> list[SkillOut]:
    rows = await db.scalars(select(Skill).order_by(Skill.display_order))
    return [_to_out(s) for s in rows]


@router.put("/skills", response_model=list[SkillOut], dependencies=[Depends(require_admin)])
async def update_skills(body: SkillsUpdate, db: DB) -> list[SkillOut]:
    await db.execute(delete(Skill))
    for s in body.skills:
        db.add(Skill(**s.model_dump()))
    await db.flush()
    log.info("skills.updated", count=len(body.skills))
    rows = await db.scalars(select(Skill).order_by(Skill.display_order))
    return [_to_out(s) for s in rows]

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select

from app.db.models import Profile, ProfileStat, SocialLink
from app.dependencies.auth import require_admin
from app.dependencies.db import DB
from app.schemas.profile import ProfileOut, ProfileStatOut, ProfileUpdate, SocialLinkOut
from core.exceptions.base import NotFoundError
from core.logging.setup import get_logger

log = get_logger(__name__)
router = APIRouter()

PROFILE_ID = 1


async def _load_profile_out(db: DB) -> ProfileOut:
    profile = await db.get(Profile, PROFILE_ID)
    if profile is None:
        raise NotFoundError(resource="Profile")

    links = await db.scalars(select(SocialLink).order_by(SocialLink.display_order))
    stats = await db.scalars(select(ProfileStat).order_by(ProfileStat.display_order))

    return ProfileOut(
        name=profile.name,
        headline=profile.headline,
        location=profile.location,
        email=profile.email,
        summary=profile.summary,
        resume_url=profile.resume_url,
        links=[
            SocialLinkOut(platform=link.platform, label=link.label, url=link.url)
            for link in links
        ],
        stats=[ProfileStatOut(label=stat.label, value=stat.value) for stat in stats],
    )


@router.get("/profile", response_model=ProfileOut)
async def get_profile(db: DB) -> ProfileOut:
    return await _load_profile_out(db)


@router.put("/profile", response_model=ProfileOut, dependencies=[Depends(require_admin)])
async def update_profile(body: ProfileUpdate, db: DB) -> ProfileOut:
    profile = await db.get(Profile, PROFILE_ID)
    if profile is None:
        raise NotFoundError(resource="Profile")

    for field in ("name", "headline", "location", "email", "summary", "resume_url"):
        value = getattr(body, field)
        if value is not None:
            setattr(profile, field, value)

    if body.links is not None:
        await db.execute(delete(SocialLink))
        for link in body.links:
            db.add(
                SocialLink(
                    platform=link.platform,
                    label=link.label,
                    url=link.url,
                    display_order=link.display_order,
                )
            )

    if body.stats is not None:
        await db.execute(delete(ProfileStat))
        for stat in body.stats:
            db.add(
                ProfileStat(
                    label=stat.label,
                    value=stat.value,
                    display_order=stat.display_order,
                )
            )

    await db.flush()
    log.info("profile.updated")
    return await _load_profile_out(db)

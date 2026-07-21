from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.models.base import AppModel

from app.db import get_session_factory


class Document(AppModel):
    text: str
    source_path: str
    doc_type: str
    title: str


async def load_documents_from_db() -> list[Document]:
    """Projects/Experience/Skills/Documents live in Postgres (services/api's
    Alembic migrations) as the sole source of truth — data/{resume,projects,
    blogs,certificates}/ is retired. Each row type is re-serialized into the
    same Document shape chunker.py/store.py/pipeline.py already expect, so
    nothing downstream of this function changes."""
    factory = get_session_factory()
    documents: list[Document] = []
    async with factory() as session:
        documents.extend(await _load_projects(session))
        documents.extend(await _load_experiences(session))
        documents.extend(await _load_skills_document(session))
        documents.extend(await _load_generic_documents(session))
    return documents


async def _load_projects(session: AsyncSession) -> list[Document]:
    rows = (
        await session.execute(
            text(
                "SELECT slug, name, summary, description, tech_stack, impact "
                "FROM projects ORDER BY display_order"
            )
        )
    ).all()

    docs = []
    for slug, name, summary, description, tech_stack, impact in rows:
        parts = [name, summary]
        if description:
            parts.append(description)
        if tech_stack:
            parts.append("Tech: " + ", ".join(tech_stack))
        if impact:
            parts.append("Impact: " + "; ".join(impact))
        docs.append(
            Document(
                text="\n\n".join(parts),
                source_path=f"db/projects/{slug}",
                doc_type="projects",
                title=name,
            )
        )
    return docs


async def _load_experiences(session: AsyncSession) -> list[Document]:
    rows = (
        await session.execute(
            text(
                "SELECT company, title, summary, achievements, tech_stack, start_date, end_date "
                "FROM experiences ORDER BY display_order"
            )
        )
    ).all()

    docs = []
    for company, title, summary, achievements, tech_stack, start_date, end_date in rows:
        duration = f"{start_date.isoformat()} - {end_date.isoformat() if end_date else 'Present'}"
        parts = [f"{title} at {company} ({duration})"]
        if summary:
            parts.append(summary)
        if achievements:
            parts.append("Achievements: " + "; ".join(achievements))
        if tech_stack:
            parts.append("Tech: " + ", ".join(tech_stack))
        docs.append(
            Document(
                text="\n\n".join(parts),
                source_path=f"db/experiences/{company.lower().replace(' ', '-')}",
                doc_type="experience",
                title=f"{title} — {company}",
            )
        )
    return docs


async def _load_skills_document(session: AsyncSession) -> list[Document]:
    """Skills are short structured facts (name + category), not narrative —
    bundled into ONE synthetic document grouped by category, rather than one
    Document per skill: ~30+ near-duplicate one-line chunks would dilute
    retrieval against each other, while one coherent per-category chunk
    serves "what languages do you know" better. `proficiency` is deliberately
    left out of the RAG text — it's a UI-only fact for the /skills page, not
    something chat should quote as a verified metric."""
    rows = (await session.execute(text("SELECT name, category FROM skills ORDER BY display_order"))).all()
    if not rows:
        return []

    by_category: dict[str, list[str]] = {}
    for name, category in rows:
        by_category.setdefault(category, []).append(name)

    lines = [f"{category}: {', '.join(names)}" for category, names in by_category.items()]
    return [
        Document(
            text="Skills\n\n" + "\n\n".join(lines),
            source_path="db/skills/all",
            doc_type="skills",
            title="Skills",
        )
    ]


async def _load_generic_documents(session: AsyncSession) -> list[Document]:
    rows = (
        await session.execute(
            text("SELECT id, doc_type, title, body FROM documents ORDER BY doc_type, display_order")
        )
    ).all()
    return [
        Document(text=body, source_path=f"db/documents/{doc_type}/{doc_id}", doc_type=doc_type, title=title)
        for doc_id, doc_type, title, body in rows
        if body and body.strip()
    ]

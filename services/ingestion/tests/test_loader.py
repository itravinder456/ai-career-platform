from contextlib import asynccontextmanager
from datetime import date
from unittest.mock import AsyncMock, MagicMock

from app import loader


def _fake_session_factory(rows_per_query: list[list[tuple]]):
    """Builds a fake `factory()` async context manager whose session.execute()
    returns each entry of `rows_per_query` in turn, one per call — mirroring
    the fixed call order in load_documents_from_db (projects, experiences,
    skills, documents)."""
    session = MagicMock()
    results = [MagicMock(all=MagicMock(return_value=rows)) for rows in rows_per_query]
    session.execute = AsyncMock(side_effect=results)

    @asynccontextmanager
    async def factory():
        yield session

    return factory


async def test_load_documents_from_db_serializes_all_row_types(monkeypatch):
    project_rows = [
        ("elsa-ai-assistant", "Elsa AI Assistant", "Flagship platform.", "Full description.", ["Python", "FastAPI"], ["35% faster"]),
    ]
    experience_rows = [
        ("EPAM Systems", "Senior Software Engineer", None, ["Did X"], ["Python"], date(2024, 1, 1), None),
    ]
    skill_rows = [("RAG", "AI / LLM"), ("LangGraph", "AI / LLM"), ("Docker", "Data & Cloud")]
    document_rows = [(1, "resume", "My Resume", "Resume body text.")]

    monkeypatch.setattr(
        loader,
        "get_session_factory",
        lambda: _fake_session_factory([project_rows, experience_rows, skill_rows, document_rows]),
    )

    documents = await loader.load_documents_from_db()

    assert len(documents) == 4

    project_doc = next(d for d in documents if d.doc_type == "projects")
    assert project_doc.source_path == "db/projects/elsa-ai-assistant"
    assert project_doc.title == "Elsa AI Assistant"
    assert "Tech: Python, FastAPI" in project_doc.text
    assert "Impact: 35% faster" in project_doc.text

    experience_doc = next(d for d in documents if d.doc_type == "experience")
    assert experience_doc.source_path == "db/experiences/epam-systems"
    assert "Senior Software Engineer at EPAM Systems (2024-01-01 - Present)" in experience_doc.text
    assert "Achievements: Did X" in experience_doc.text

    skills_doc = next(d for d in documents if d.doc_type == "skills")
    assert skills_doc.source_path == "db/skills/all"
    assert "AI / LLM: RAG, LangGraph" in skills_doc.text
    assert "Data & Cloud: Docker" in skills_doc.text

    generic_doc = next(d for d in documents if d.doc_type == "resume")
    assert generic_doc.source_path == "db/documents/resume/1"
    assert generic_doc.text == "Resume body text."


async def test_load_documents_from_db_skips_blank_generic_bodies(monkeypatch):
    document_rows = [(1, "blog", "Empty draft", "   "), (2, "blog", "Real post", "Actual content.")]

    monkeypatch.setattr(
        loader,
        "get_session_factory",
        lambda: _fake_session_factory([[], [], [], document_rows]),
    )

    documents = await loader.load_documents_from_db()

    assert len(documents) == 1
    assert documents[0].title == "Real post"


async def test_load_documents_from_db_returns_empty_when_all_tables_empty(monkeypatch):
    monkeypatch.setattr(
        loader,
        "get_session_factory",
        lambda: _fake_session_factory([[], [], [], []]),
    )

    documents = await loader.load_documents_from_db()

    assert documents == []

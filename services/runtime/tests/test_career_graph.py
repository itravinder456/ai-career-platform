from unittest.mock import AsyncMock

import pytest
from langgraph.checkpoint.memory import InMemorySaver

from app.graphs import career
from app.graphs.career import (
    build_career_graph,
    classify_intent,
    load_architecture_context,
    load_general_context,
    load_jd_context,
    load_project_context,
    load_resume_context,
    load_skills_context,
)

ALL_CONTEXT_LOADERS = [
    load_project_context,
    load_skills_context,
    load_resume_context,
    load_jd_context,
    load_architecture_context,
    load_general_context,
]


def test_build_career_graph_compiles():
    graph = build_career_graph(InMemorySaver())

    assert graph is not None


@pytest.mark.parametrize(
    "user_input,expected_intent",
    [
        ("Tell me about a project you built", "project"),
        ("What tech stack do you know", "skills"),
        ("Walk me through your resume", "resume"),
        ("Here's a job description, are you a fit for this role", "jd_match"),
        ("How does the architecture work", "architecture"),
        ("Hello there", "general"),
    ],
)
def test_classify_intent(user_input, expected_intent):
    result = classify_intent({"user_input": user_input})

    assert result == {"intent": expected_intent}


@pytest.mark.parametrize("loader", ALL_CONTEXT_LOADERS)
async def test_all_context_loaders_run_mandatory_retrieval(monkeypatch, loader):
    # Including load_general_context: retrieval is universal, not gated by intent —
    # classify_intent's keyword match can miss real career questions (e.g. "tell me
    # about yourself"), so "general" must not be a fabrication loophole.
    retrieve_context = AsyncMock(return_value="[resume.pdf] retrieved fact")
    monkeypatch.setattr(career, "retrieve_context", retrieve_context)

    result = await loader({"user_input": "what did you build at your last job"})

    retrieve_context.assert_awaited_once_with("what did you build at your last job")
    assert result["context"]["retrieved"] == "[resume.pdf] retrieved fact"
    assert "hint" in result["context"]

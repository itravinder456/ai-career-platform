from unittest.mock import AsyncMock

import pytest

from app.executor import task_executor
from app.executor.task_executor import run_task


class _FakeAIMessage:
    def __init__(self, content: str) -> None:
        self.content = content


class _FakeLLM:
    """Stands in for build_llm's return value — _verify_and_refine only ever calls
    .ainvoke(messages) and reads .content, so that's all this needs to fake."""

    def __init__(self, content: str) -> None:
        self._content = content

    async def ainvoke(self, messages):
        return _FakeAIMessage(self._content)


class _RaisingLLM:
    async def ainvoke(self, messages):
        raise RuntimeError("provider hiccup")


async def test_run_task_returns_hint_matching_intent(monkeypatch):
    monkeypatch.setattr(task_executor, "build_llm", lambda settings: _FakeLLM("SUFFICIENT"))
    retrieve_context = AsyncMock(return_value="[resume.pdf] built Elsa AI Assistant")
    monkeypatch.setattr(task_executor, "retrieve_context", retrieve_context)

    result = await run_task({"intent": "project", "query": "what have you built"})

    retrieve_context.assert_awaited_once_with("what have you built")
    assert result == {
        "intent": "project",
        "query": "what have you built",
        "retrieved": "[resume.pdf] built Elsa AI Assistant",
        "hint": task_executor.INTENT_HINTS["project"],
    }


async def test_run_task_retries_retrieval_once_when_insufficient(monkeypatch):
    monkeypatch.setattr(
        task_executor,
        "build_llm",
        lambda settings: _FakeLLM("INSUFFICIENT: Ravinder education degree university"),
    )
    retrieve_context = AsyncMock(
        side_effect=["", "[resume.pdf] Bachelor of Technology, CSE"]
    )
    monkeypatch.setattr(task_executor, "retrieve_context", retrieve_context)

    result = await run_task({"intent": "resume", "query": "where did you study"})

    assert retrieve_context.await_count == 2
    retrieve_context.assert_awaited_with("Ravinder education degree university")
    assert result["retrieved"] == "[resume.pdf] Bachelor of Technology, CSE"


@pytest.mark.parametrize("intent", list(task_executor.INTENT_HINTS.keys()))
async def test_run_task_covers_every_intent(monkeypatch, intent):
    monkeypatch.setattr(task_executor, "build_llm", lambda settings: _FakeLLM("SUFFICIENT"))
    monkeypatch.setattr(
        task_executor, "retrieve_context", AsyncMock(return_value="[doc] fact")
    )

    result = await run_task({"intent": intent, "query": "some question"})

    assert result["hint"] == task_executor.INTENT_HINTS[intent]


async def test_verify_and_refine_fails_open_on_llm_exception(monkeypatch):
    # A single-branch sufficiency-check failure used to just fail the one linear turn;
    # now this runs inside one of N parallel Send branches, so an unhandled exception
    # here would abort the whole multi-task turn, including branches that already
    # succeeded — must fail open and keep whatever was already retrieved instead.
    monkeypatch.setattr(task_executor, "build_llm", lambda settings: _RaisingLLM())
    retrieve_context = AsyncMock()
    monkeypatch.setattr(task_executor, "retrieve_context", retrieve_context)

    retrieved = await task_executor._verify_and_refine(
        {"intent": "general", "query": "anything"}, "[doc] original fact"
    )

    retrieve_context.assert_not_awaited()
    assert retrieved == "[doc] original fact"

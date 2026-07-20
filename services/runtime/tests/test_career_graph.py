from unittest.mock import AsyncMock

import pytest
from langchain_core.messages import AIMessage, HumanMessage
from langgraph.checkpoint.memory import InMemorySaver

from app.executor import task_executor
from app.graphs import career
from app.graphs.career import build_career_graph, execute_task, plan_tasks, respond


def test_build_career_graph_compiles():
    graph = build_career_graph(InMemorySaver())

    assert graph is not None


class _FakeAIMessage:
    def __init__(self, content: str) -> None:
        self.content = content


class _FakeLLM:
    """Stands in for build_llm's return value — plan_tasks/respond only ever call
    .ainvoke(messages) and read .content, so that's all this needs to fake."""

    def __init__(self, content: str) -> None:
        self._content = content

    async def ainvoke(self, messages):
        return _FakeAIMessage(self._content)


@pytest.mark.parametrize(
    "llm_reply,expected_tasks",
    [
        (
            '[{"intent":"project","query":"what have you built"}]',
            [{"intent": "project", "query": "what have you built"}],
        ),
        (
            '[{"intent":"project","query":"what have you built"},'
            '{"intent":"skills","query":"tech stack"}]',
            [
                {"intent": "project", "query": "what have you built"},
                {"intent": "skills", "query": "tech stack"},
            ],
        ),
        # Malformed JSON — plan_tasks falls open to a single general task wrapping the
        # original message, same fail-open convention as parse_plan itself.
        (
            "not json at all",
            [{"intent": "general", "query": "irrelevant — the fake LLM ignores it"}],
        ),
    ],
)
async def test_plan_tasks(monkeypatch, llm_reply, expected_tasks):
    monkeypatch.setattr(career, "build_llm", lambda settings: _FakeLLM(llm_reply))

    result = await plan_tasks({"user_input": "irrelevant — the fake LLM ignores it"})

    assert result == {"tasks": expected_tasks}


async def test_execute_task_wraps_run_task_result_in_a_list(monkeypatch):
    monkeypatch.setattr(
        task_executor, "build_llm", lambda settings: _FakeLLM("SUFFICIENT")
    )
    monkeypatch.setattr(
        task_executor, "retrieve_context", AsyncMock(return_value="[doc] a fact")
    )

    task = {"intent": "skills", "query": "what's your tech stack"}
    result = await execute_task({"task": task})

    assert result == {
        "results": [
            {
                "intent": "skills",
                "query": "what's your tech stack",
                "retrieved": "[doc] a fact",
                "hint": task_executor.INTENT_HINTS["skills"],
            }
        ]
    }


async def test_respond_synthesizes_from_all_results(monkeypatch):
    monkeypatch.setattr(
        career,
        "build_llm",
        lambda settings: _FakeLLM(
            "I built Elsa AI Assistant and work daily with Python and FastAPI."
        ),
    )

    state = {
        "messages": [HumanMessage(content="what have you built and what's your stack")],
        "results": [
            {
                "intent": "project",
                "query": "what have you built",
                "retrieved": "[resume.pdf] built Elsa AI Assistant",
                "hint": "Describe projects in detail.",
            },
            {
                "intent": "skills",
                "query": "tech stack",
                "retrieved": "[resume.pdf] Python, FastAPI, LangGraph",
                "hint": "List skills grouped sensibly.",
            },
        ],
    }
    result = await respond(state)

    assert result["response"] == (
        "I built Elsa AI Assistant and work daily with Python and FastAPI."
    )
    assert result["widgets"] == []


async def test_multi_task_query_fans_out_and_fans_in(monkeypatch):
    # Integration test exercising the Send-based fan-out/fan-in wiring itself, not just
    # individual node bodies — routes on which system prompt each ainvoke call receives
    # so plan/sufficiency/respond can each return a distinct canned reply.
    def build_llm_for(settings):
        class RoutingLLM:
            async def ainvoke(self, messages):
                system = messages[0].content
                if "sub-questions" in system:
                    return _FakeAIMessage(
                        '[{"intent":"project","query":"what have you built"},'
                        '{"intent":"skills","query":"tech stack"}]'
                    )
                if "SUFFICIENT" in system:
                    return _FakeAIMessage("SUFFICIENT")
                # respond()'s return value flows through the `messages` state key's
                # add_messages reducer, which requires a real BaseMessage — the plain
                # _FakeAIMessage duck-type used elsewhere in this file isn't enough here.
                return AIMessage(content="Here's both: projects and stack, in one answer.")

        return RoutingLLM()

    monkeypatch.setattr(career, "build_llm", build_llm_for)
    monkeypatch.setattr(task_executor, "build_llm", build_llm_for)
    monkeypatch.setattr(
        task_executor, "retrieve_context", AsyncMock(return_value="[doc] a fact")
    )

    graph = build_career_graph(InMemorySaver())
    result = await graph.ainvoke(
        {
            "messages": [
                HumanMessage(content="what have you built and what's your tech stack")
            ],
            "session_id": "test-session",
            "user_input": "what have you built and what's your tech stack",
            "tasks": [],
            "results": [],
            "response": "",
            "widgets": [],
        },
        config={"configurable": {"thread_id": "test-session"}},
    )

    assert len(result["tasks"]) == 2
    assert len(result["results"]) == 2
    assert {r["intent"] for r in result["results"]} == {"project", "skills"}
    assert result["response"] == "Here's both: projects and stack, in one answer."

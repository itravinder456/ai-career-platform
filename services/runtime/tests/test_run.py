import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

from app.api.v1 import run as run_module
from app.api.v1.run import RunRequest, _stream


class _FakeChunk:
    def __init__(self, content: str) -> None:
        self.content = content


class _FakeSnapshot:
    def __init__(self, values: dict) -> None:
        self.values = values


class _FakeGraph:
    """Stands in for the compiled LangGraph — `_stream` only ever calls .astream()
    (an async generator), .aupdate_state(), and .aget_state(). `has_history=False`
    (the default) simulates a brand-new session with no prior checkpoint, matching
    what aget_state actually returns for one (confirmed against a real InMemorySaver-
    backed graph — snapshot.values == {} for an unseen thread_id)."""

    def __init__(self, events: list, has_history: bool = False) -> None:
        self._events = events
        self.aupdate_state = AsyncMock()
        values = {"messages": ["prior turn"]} if has_history else {}
        self.aget_state = AsyncMock(return_value=_FakeSnapshot(values))

    async def astream(self, initial_state, config, stream_mode):
        for event in self._events:
            yield event


def _fake_request(graph: _FakeGraph) -> SimpleNamespace:
    return SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(career_graph=graph)))


def _parse_events(raw_events: list[str]) -> list[dict]:
    return [json.loads(e[len("data: ") :].strip()) for e in raw_events]


async def test_stream_cache_hit_skips_the_graph_entirely(monkeypatch):
    monkeypatch.setattr(
        run_module,
        "get_cached_turn",
        AsyncMock(return_value=("Cached answer.", [{"type": "widget", "widget_type": "tech_stack", "data": {}}])),
    )
    set_cached_turn = AsyncMock()
    monkeypatch.setattr(run_module, "set_cached_turn", set_cached_turn)

    graph = _FakeGraph(events=[])  # would raise/hang if actually iterated
    body = RunRequest(session_id="s1", message="what's your tech stack")

    events = _parse_events([e async for e in _stream(body, _fake_request(graph))])

    assert events[0] == {"type": "token", "content": "Cached answer."}
    assert events[1] == {"type": "widget", "widget_type": "tech_stack", "data": {}}
    assert events[2] == {"type": "done"}
    set_cached_turn.assert_not_awaited()
    graph.aupdate_state.assert_awaited_once()
    (config, values), _ = graph.aupdate_state.await_args
    assert config == {"configurable": {"thread_id": "s1"}}
    assert [m.content for m in values["messages"]] == ["what's your tech stack", "Cached answer."]


async def test_stream_cache_hit_still_responds_if_history_update_fails(monkeypatch):
    monkeypatch.setattr(
        run_module, "get_cached_turn", AsyncMock(return_value=("Cached answer.", []))
    )
    monkeypatch.setattr(run_module, "set_cached_turn", AsyncMock())

    graph = _FakeGraph(events=[])
    graph.aupdate_state = AsyncMock(side_effect=RuntimeError("checkpointer down"))
    body = RunRequest(session_id="s1", message="what's your tech stack")

    events = _parse_events([e async for e in _stream(body, _fake_request(graph))])

    assert {"type": "done"} in events
    assert {"type": "token", "content": "Cached answer."} in events


async def test_stream_cache_miss_runs_graph_and_populates_cache(monkeypatch):
    monkeypatch.setattr(run_module, "get_cached_turn", AsyncMock(return_value=None))
    set_cached_turn = AsyncMock()
    monkeypatch.setattr(run_module, "set_cached_turn", set_cached_turn)

    events = [
        ("custom", {"type": "step", "id": "plan", "label": "Understanding your question", "status": "running"}),
        ("messages", (_FakeChunk("Hello"), {"langgraph_node": "plan_tasks"})),  # filtered out
        ("messages", (_FakeChunk("I built "), {"langgraph_node": "respond"})),
        ("messages", (_FakeChunk("Elsa."), {"langgraph_node": "respond"})),
    ]
    graph = _FakeGraph(events=events)
    body = RunRequest(session_id="s1", message="tell me about your projects")

    parsed = _parse_events([e async for e in _stream(body, _fake_request(graph))])

    token_events = [e for e in parsed if e["type"] == "token"]
    assert "".join(e["content"] for e in token_events) == "I built Elsa."
    assert parsed[-1] == {"type": "done"}

    set_cached_turn.assert_awaited_once_with("tell me about your projects", "I built Elsa.", [])
    graph.aupdate_state.assert_not_awaited()


async def test_stream_error_path_never_populates_cache(monkeypatch):
    monkeypatch.setattr(run_module, "get_cached_turn", AsyncMock(return_value=None))
    set_cached_turn = AsyncMock()
    monkeypatch.setattr(run_module, "set_cached_turn", set_cached_turn)

    class _RaisingGraph(_FakeGraph):
        async def astream(self, initial_state, config, stream_mode):
            raise RuntimeError("boom")
            yield  # pragma: no cover — makes this an async generator

    body = RunRequest(session_id="s1", message="anything")

    parsed = _parse_events([e async for e in _stream(body, _fake_request(_RaisingGraph([])))])

    assert parsed[0]["type"] == "error"
    set_cached_turn.assert_not_awaited()


# ── Mid-conversation: the response cache must never be consulted or populated ──


async def test_stream_mid_conversation_never_checks_the_response_cache(monkeypatch):
    get_cached_turn = AsyncMock(return_value=("Would-be cached answer.", []))
    monkeypatch.setattr(run_module, "get_cached_turn", get_cached_turn)
    monkeypatch.setattr(run_module, "set_cached_turn", AsyncMock())

    events = [("messages", (_FakeChunk("A fresh, context-aware answer."), {"langgraph_node": "respond"}))]
    graph = _FakeGraph(events=events, has_history=True)
    body = RunRequest(session_id="s1", message="what's your tech stack")

    parsed = _parse_events([e async for e in _stream(body, _fake_request(graph))])

    get_cached_turn.assert_not_awaited()
    token_events = [e for e in parsed if e["type"] == "token"]
    assert "".join(e["content"] for e in token_events) == "A fresh, context-aware answer."
    graph.aupdate_state.assert_not_awaited()  # real graph run updates history itself


async def test_stream_mid_conversation_never_populates_the_response_cache(monkeypatch):
    monkeypatch.setattr(run_module, "get_cached_turn", AsyncMock(return_value=None))
    set_cached_turn = AsyncMock()
    monkeypatch.setattr(run_module, "set_cached_turn", set_cached_turn)

    events = [("messages", (_FakeChunk("An answer."), {"langgraph_node": "respond"}))]
    graph = _FakeGraph(events=events, has_history=True)
    body = RunRequest(session_id="s1", message="what's your tech stack")

    [e async for e in _stream(body, _fake_request(graph))]

    set_cached_turn.assert_not_awaited()


async def test_is_fresh_session_fails_closed_when_state_lookup_errors(monkeypatch):
    monkeypatch.setattr(run_module, "get_cached_turn", AsyncMock(return_value=("cached", [])))
    set_cached_turn = AsyncMock()
    monkeypatch.setattr(run_module, "set_cached_turn", set_cached_turn)

    events = [("messages", (_FakeChunk("Real answer."), {"langgraph_node": "respond"}))]
    graph = _FakeGraph(events=events)
    graph.aget_state = AsyncMock(side_effect=RuntimeError("checkpointer unreachable"))
    body = RunRequest(session_id="s1", message="anything")

    parsed = _parse_events([e async for e in _stream(body, _fake_request(graph))])

    # Falls back to a real graph run rather than trusting a cache it couldn't verify
    # was safe to use.
    token_events = [e for e in parsed if e["type"] == "token"]
    assert "".join(e["content"] for e in token_events) == "Real answer."
    set_cached_turn.assert_not_awaited()

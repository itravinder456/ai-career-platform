import operator
from typing import Annotated, Any, Literal

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict

Intent = Literal["project", "skills", "resume", "jd_match", "architecture", "general"]


class Task(TypedDict):
    intent: Intent
    query: str  # focused, self-contained sub-question the planner extracted


class TaskResult(TypedDict):
    intent: Intent
    query: str
    retrieved: str
    hint: str


class TaskExecutionInput(TypedDict):
    """execute_task's actual parameter type — deliberately NOT AgentState. A Send's
    payload replaces the state entirely for that branch invocation, so the node can
    only ever read what's in here, not the full graph state."""

    task: Task


class AgentState(TypedDict):
    # Core conversation state — add_messages merges lists intelligently
    messages: Annotated[list[BaseMessage], add_messages]

    # Request metadata
    session_id: str
    user_input: str

    # Planning result — the focused sub-tasks the planner decomposed user_input into
    tasks: list[Task]

    # Per-task results, fanned in from parallel execute_task branches (Send/map-reduce)
    results: Annotated[list[TaskResult], operator.add]

    # Final outputs
    response: str
    widgets: list[dict[str, Any]]

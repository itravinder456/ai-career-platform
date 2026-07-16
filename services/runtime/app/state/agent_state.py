from typing import Annotated, Any, Literal

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict

Intent = Literal["project", "skills", "resume", "jd_match", "architecture", "general"]


class AgentState(TypedDict):
    # Core conversation state — add_messages merges lists intelligently
    messages: Annotated[list[BaseMessage], add_messages]

    # Request metadata
    session_id: str
    user_input: str

    # Classification result
    intent: Intent

    # Additional context passed between nodes
    context: dict[str, Any]

    # Final outputs
    response: str
    widgets: list[dict[str, Any]]

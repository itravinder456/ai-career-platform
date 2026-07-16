"""
Career AI — LangGraph supervisor graph.

Flow:
  START → classify_intent → route → [project | skills | resume | jd_match | architecture | general]
                                   → respond ⇄ tools → END
                                     (tool loop only fires once TOOLS below is non-empty)

Each specialised node enriches `state.context` with the right knowledge-base data
then hands off to `respond` which calls the LLM with the full context. `respond`
loops through `tools` whenever the LLM emits tool calls, and only reaches END
once it answers without requesting a tool — the standard ReAct shape, via
LangGraph's prebuilt ToolNode/tools_condition.
"""

import json

from langchain_anthropic import ChatAnthropic
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import SystemMessage
from langchain_core.tools import BaseTool
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import START, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition

from app.knowledge.profile import (
    PROFILE,
    PROJECTS_DETAIL,
    RESUME_DATA,
    SKILLS_DETAIL,
    TECH_STACK_CATEGORIES,
)
from app.state.agent_state import AgentState, Intent
from core.config import get_settings
from core.logging.setup import get_logger

log = get_logger(__name__)

# ── Tools ─────────────────────────────────────────────────────────────────────
# Scaffold for multi-step reasoning: empty for now. To add a tool, write a
# @tool-decorated function and append it here — no other graph changes needed,
# the respond ⇄ tools loop below already handles routing, execution, and
# looping back with the tool's result.
TOOLS: list[BaseTool] = []

# ── System prompt ──────────────────────────────────────────────────────────────

BASE_SYSTEM = f"""You are Ravinder AI, an intelligent AI assistant that represents Ravinder Varikuppala \
to recruiters and hiring managers. Answer questions accurately based ONLY on the provided profile data. \
Be concise, confident, and professional — like Ravinder himself speaking.

'You' - always refers to Ravinder Varikuppala. 'I' - always refers to Ravinder AI, the assistant.

When you comes from the user, it is a question or request about Ravinder's skills, experience, projects, or resume. \

When listing projects or skills, include specific metrics and tech names. \
If asked about something not in the profile, say so honestly.

Do NOT hallucinate job titles, companies, or technologies not listed below.

--- PROFILE ---
{PROFILE}
"""

WIDGET_INSTRUCTION = """
After your response, if the context warrants it, output a WIDGET block on a new line:
Format: WIDGET:<type>:<json>

Supported widget types and their JSON schemas:
- WIDGET:skill_graph:{{"skills":[{{"name":"...","level":0-100}}]}}
- WIDGET:tech_stack:{{"categories":[{{"label":"...","items":["..."]}}]}}
- WIDGET:project_card:{{"name":"...","description":"...","status":"...","tech":["..."],"impact":["..."],"github":"url or null"}}
- WIDGET:resume_preview:{{"name":"...","title":"...","experience":[{{"company":"...","role":"...","duration":"...","highlight":"..."}}],"education":"...","downloadUrl":"/resume.pdf"}}
- WIDGET:architecture:{{"layers":[{{"name":"...","items":["..."]}}]}}

Only emit ONE widget per response, only when it genuinely helps visualise the data.
"""


# ── Node: classify intent ──────────────────────────────────────────────────────


def classify_intent(state: AgentState) -> dict:
    user_input = state["user_input"].lower()

    if any(
        k in user_input
        for k in ("project", "built", "work on", "portfolio", "system", "platform")
    ):
        intent: Intent = "project"
    elif any(
        k in user_input
        for k in ("skill", "know", "tech", "stack", "language", "framework", "tool")
    ):
        intent = "skills"
    elif any(
        k in user_input
        for k in ("resume", "cv", "experience", "background", "work history")
    ):
        intent = "resume"
    elif any(
        k in user_input
        for k in (
            "job",
            "jd",
            "description",
            "match",
            "fit",
            "role",
            "position",
            "hiring",
        )
    ):
        intent = "jd_match"
    elif any(
        k in user_input
        for k in (
            "architecture",
            "design",
            "diagram",
            "flow",
            "how does",
            "how it works",
        )
    ):
        intent = "architecture"
    else:
        intent = "general"

    log.info("intent.classified", intent=intent, input_preview=user_input[:80])
    return {"intent": intent}


# ── Node: context loaders (one per intent) ────────────────────────────────────


def load_project_context(state: AgentState) -> dict:
    return {
        "context": {
            "projects": PROJECTS_DETAIL,
            "hint": "Describe projects in detail with tech, impact, and architecture. Offer the project_card widget.",
        }
    }


def load_skills_context(state: AgentState) -> dict:
    return {
        "context": {
            "skills": SKILLS_DETAIL,
            "tech_stack": TECH_STACK_CATEGORIES,
            "hint": "List skills with proficiency percentages. Offer skill_graph or tech_stack widget.",
        }
    }


def load_resume_context(state: AgentState) -> dict:
    return {
        "context": {
            "resume": RESUME_DATA,
            "hint": "Summarise experience concisely. Offer the resume_preview widget.",
        }
    }


def load_jd_context(state: AgentState) -> dict:
    return {
        "context": {
            "skills": SKILLS_DETAIL,
            "projects": PROJECTS_DETAIL,
            "hint": "Analyse the JD against Ravinder's skills and experience. Score the match out of 10. Be specific about gaps.",
        }
    }


def load_architecture_context(state: AgentState) -> dict:
    return {
        "context": {
            "projects": PROJECTS_DETAIL,
            "hint": "Describe architecture layers, components, and data flow. Offer the architecture widget.",
        }
    }


def load_general_context(state: AgentState) -> dict:
    return {
        "context": {
            "hint": "Answer from the profile data. Be conversational and helpful.",
        }
    }


def _build_llm(s) -> BaseChatModel:  # type: ignore[no-untyped-def]
    provider = s.llm_provider.lower()
    if provider == "groq":
        from langchain_groq import ChatGroq

        if not s.groq_api_key:
            raise ValueError("GROQ_API_KEY is required when LLM_PROVIDER=groq")
        llm = ChatGroq(
            model=s.groq_model,
            api_key=s.groq_api_key.get_secret_value(),
            temperature=s.llm_temperature,
        )
    elif provider == "ollama":
        from langchain_ollama import ChatOllama

        llm = ChatOllama(
            model=s.ollama_model,
            base_url=s.ollama_base_url,
            temperature=s.llm_temperature,
        )
    else:
        # Default: anthropic
        if not s.anthropic_api_key:
            raise ValueError(
                "ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic"
            )
        llm = ChatAnthropic(
            model=s.anthropic_model,
            api_key=s.anthropic_api_key.get_secret_value(),
            max_tokens=s.llm_max_tokens,
            temperature=s.llm_temperature,
        )
    return llm.bind_tools(TOOLS) if TOOLS else llm


# ── Node: respond (calls LLM, extracts widgets, loops through tools) ─────────
#
# state["messages"] already holds the full conversation (checkpointer loads
# prior turns; the caller appends only the new HumanMessage before invoking).
# On a loop-back from `tools`, it additionally holds the AIMessage that
# requested the tool call(s) plus the ToolMessage result(s).


async def respond(state: AgentState) -> dict:
    s = get_settings()
    llm = _build_llm(s)

    context_block = ""
    if state.get("context"):
        context_block = f"\n\n--- CONTEXT ---\n{json.dumps(state['context'], indent=2)}"

    system = BASE_SYSTEM + context_block + "\n\n" + WIDGET_INSTRUCTION
    lc_messages = [SystemMessage(content=system), *state["messages"]]

    ai_message = await llm.ainvoke(lc_messages)

    if getattr(ai_message, "tool_calls", None):
        # Mid-reasoning step — tools_condition routes this to the "tools" node next.
        return {"messages": [ai_message]}

    full_text = str(ai_message.content)

    # Parse out any widget block
    widgets: list[dict] = []
    response_text = full_text

    if "WIDGET:" in full_text:
        parts = full_text.split("WIDGET:", 1)
        response_text = parts[0].strip()
        widget_raw = parts[1].strip()

        try:
            colon_idx = widget_raw.index(":")
            widget_type = widget_raw[:colon_idx]
            widget_data = json.loads(widget_raw[colon_idx + 1 :])
            widgets = [
                {"type": "widget", "widget_type": widget_type, "data": widget_data}
            ]
        except Exception as exc:
            log.warning("widget.parse.error", error=str(exc), raw=widget_raw[:200])

    return {"messages": [ai_message], "response": response_text, "widgets": widgets}


# ── Routing function ───────────────────────────────────────────────────────────


def route_by_intent(state: AgentState) -> str:
    return state["intent"]


# ── Build the graph ────────────────────────────────────────────────────────────


def build_career_graph(checkpointer: BaseCheckpointSaver) -> StateGraph:
    builder = StateGraph(AgentState)

    # Nodes
    builder.add_node("classify_intent", classify_intent)
    builder.add_node("project", load_project_context)
    builder.add_node("skills", load_skills_context)
    builder.add_node("resume", load_resume_context)
    builder.add_node("jd_match", load_jd_context)
    builder.add_node("architecture", load_architecture_context)
    builder.add_node("general", load_general_context)
    builder.add_node("respond", respond)
    builder.add_node("tools", ToolNode(TOOLS))

    # Entry
    builder.add_edge(START, "classify_intent")

    # Conditional routing by intent
    builder.add_conditional_edges(
        "classify_intent",
        route_by_intent,
        {
            "project": "project",
            "skills": "skills",
            "resume": "resume",
            "jd_match": "jd_match",
            "architecture": "architecture",
            "general": "general",
        },
    )

    # All context nodes flow into respond
    for node in ("project", "skills", "resume", "jd_match", "architecture", "general"):
        builder.add_edge(node, "respond")

    # respond -> tools (if the LLM requested a tool call) -> back to respond, else END
    builder.add_conditional_edges("respond", tools_condition)
    builder.add_edge("tools", "respond")

    return builder.compile(checkpointer=checkpointer)

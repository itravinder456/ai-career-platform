"""
Career AI — LangGraph supervisor graph.

Flow:
  START → classify_intent → route → [project | skills | resume | jd_match | architecture | general]
                                   → respond → END

Each specialised node enriches `state.context` with the right knowledge-base data
(mandatory RAG retrieval — see below) then hands off to `respond`, which calls the
LLM with the full context and returns the final answer.

No tool-calling is bound to this LLM call right now — retrieval already runs
automatically per intent (app.tools.retrieval.retrieve_context), so the base LLM has
no need to call tools itself, and Groq's streaming + bound-tools combination was
throwing intermittent `tool call validation failed` errors mid-stream. Real agentic
tool-calling (a planner routing to sub-agents/tools) is deliberately deferred to the
upcoming multi-agent/planner-executor work rather than patched back in here.

LLM provider selection lives in app.core.llm (graph-agnostic — reusable by any future
graph); prompt templates and the WIDGET-parsing protocol live in app.prompts. This file
holds only what's specific to *this* graph: intent taxonomy, context assembly, and topology.
"""

import json

from langchain_core.messages import SystemMessage
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, StateGraph

from app.core.llm import build_llm
from app.prompts.career import BASE_SYSTEM, WIDGET_INSTRUCTION, parse_widget_block
from app.state.agent_state import AgentState, Intent
from app.streaming import emit_step
from app.tools.retrieval import retrieve_context
from core.config import get_settings
from core.logging.setup import get_logger

log = get_logger(__name__)


# ── Node: classify intent ──────────────────────────────────────────────────────


def classify_intent(state: AgentState) -> dict:
    emit_step("classify")
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
#
# All six run mandatory retrieval against Qdrant using the user's own question as the
# query — career facts come from RAG only (see app.knowledge.profile and
# app.prompts.career), never from hardcoded data. This is deliberately universal, not
# gated by intent: classify_intent is a keyword match and *will* miss real career
# questions phrased unexpectedly (e.g. "tell me about yourself" matches no keyword and
# used to fall to "general", which skipped retrieval — with zero grounding, the model
# would sometimes fabricate a plausible-sounding bio instead of admitting it had no
# data). Retrieving unconditionally means there's always real context to answer from
# or to honestly say "not covered", never a genuinely empty-handed model.


async def load_project_context(state: AgentState) -> dict:
    emit_step("retrieve")
    return {
        "context": {
            "retrieved": await retrieve_context(state["user_input"]),
            "hint": "Describe projects in detail with tech, impact, and architecture. Offer the "
            "project_card widget.",
        }
    }


async def load_skills_context(state: AgentState) -> dict:
    emit_step("retrieve")
    return {
        "context": {
            "retrieved": await retrieve_context(state["user_input"]),
            "hint": "List skills grouped sensibly. Offer the tech_stack widget.",
        }
    }


async def load_resume_context(state: AgentState) -> dict:
    emit_step("retrieve")
    return {
        "context": {
            "retrieved": await retrieve_context(state["user_input"]),
            "hint": "Summarise experience concisely. Offer the resume_preview widget.",
        }
    }


async def load_jd_context(state: AgentState) -> dict:
    emit_step("retrieve")
    return {
        "context": {
            "retrieved": await retrieve_context(state["user_input"]),
            "hint": "Analyse the JD against Ravinder's skills and experience. Score the match out "
            "of 10. Be specific about gaps.",
        }
    }


async def load_architecture_context(state: AgentState) -> dict:
    emit_step("retrieve")
    return {
        "context": {
            "retrieved": await retrieve_context(state["user_input"]),
            "hint": "Describe architecture layers, components, and data flow. Offer the "
            "architecture widget.",
        }
    }


async def load_general_context(state: AgentState) -> dict:
    emit_step("retrieve")
    return {
        "context": {
            "retrieved": await retrieve_context(state["user_input"]),
            "hint": "Be conversational and helpful. If the retrieved content doesn't cover this, "
            "say so honestly rather than guessing.",
        }
    }


# ── Node: respond (calls the LLM, extracts widgets) ──────────────────────────
#
# state["messages"] already holds the full conversation (checkpointer loads
# prior turns; the caller appends only the new HumanMessage before invoking).


async def respond(state: AgentState) -> dict:
    emit_step("respond")
    llm = build_llm(get_settings())

    context_block = ""
    if state.get("context"):
        context_block = f"\n\n--- CONTEXT ---\n{json.dumps(state['context'], indent=2)}"

    system = BASE_SYSTEM + context_block + "\n\n" + WIDGET_INSTRUCTION
    lc_messages = [SystemMessage(content=system), *state["messages"]]

    ai_message = await llm.ainvoke(lc_messages)
    response_text, widgets = parse_widget_block(str(ai_message.content))

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

    # All context nodes flow into respond, which is the final step
    for node in ("project", "skills", "resume", "jd_match", "architecture", "general"):
        builder.add_edge(node, "respond")
    builder.add_edge("respond", END)

    return builder.compile(checkpointer=checkpointer)

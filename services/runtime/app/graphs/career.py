"""
Career AI — LangGraph planner-executor graph.

Flow:
  START → plan_tasks → fan_out_tasks (Send × N) → execute_task (parallel)
                                                  → respond → END

`plan_tasks` decomposes the user's message into 1-4 focused, self-contained sub-tasks
(most messages produce exactly one — a compound recruiter question like "what have you
built, what's your tech stack, and are you a fit for this JD" produces several).
`fan_out_tasks` dynamically dispatches one `execute_task` invocation per task via
LangGraph's `Send` — these run concurrently, each doing mandatory RAG retrieval plus an
inline sufficiency-check-and-retry (app.executor.task_executor.run_task), and fan back in
to a shared `results` list (AgentState.results, an Annotated[..., operator.add] reducer —
same convention as `messages`/add_messages). `respond` waits for every branch, then makes
the one LLM call that synthesizes everything into a single coherent answer and extracts
any WIDGET blocks.

No tool-calling is bound to any of these LLM calls — retrieval already runs automatically
per task (app.tools.retrieval.retrieve_context), so the base LLM has no need to call tools
itself, and Groq's streaming + bound-tools combination was throwing intermittent `tool
call validation failed` errors mid-stream. Real agentic tool-calling (sub-agents that
decide their own actions) is deliberately deferred to a later phase rather than patched
back in here — execute_task is a parameterized retrieval+verify step, not an agent, which
is why this logic lives under app/executor/ and app/agents/ stays an empty stub.

LLM provider selection lives in app.core.llm (graph-agnostic — reusable by any future
graph); prompt templates and the WIDGET-parsing protocol live in app.prompts. This file
holds only what's specific to *this* graph: task planning, fan-out wiring, and respond.
"""

import json

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Send

from app.core.llm import build_llm
from app.executor.task_executor import run_task
from app.prompts.career import (
    PLAN_SYSTEM_PROMPT,
    WIDGET_INSTRUCTION,
    build_base_system,
    parse_plan,
    parse_widget_block,
)
from app.state.agent_state import AgentState, TaskExecutionInput
from app.streaming import emit_step
from core.config import get_settings
from core.logging.setup import get_logger

log = get_logger(__name__)


# ── Node: plan tasks ────────────────────────────────────────────────────────────


async def plan_tasks(state: AgentState) -> dict:
    emit_step("plan")
    llm = build_llm(get_settings())

    ai_message = await llm.ainvoke(
        [
            SystemMessage(content=PLAN_SYSTEM_PROMPT),
            HumanMessage(content=state["user_input"]),
        ]
    )
    tasks = parse_plan(str(ai_message.content), fallback_query=state["user_input"])
    if not tasks:
        # Structurally impossible per parse_plan's own fail-open contract, but an empty
        # tasks list means fan_out_tasks dispatches nothing and respond() never runs —
        # the turn would silently produce no answer with no error surfaced. Guard here
        # too rather than trust that invariant to hold from one call site alone.
        tasks = [{"intent": "general", "query": state["user_input"]}]

    log.info("tasks.planned", count=len(tasks), input_preview=state["user_input"][:80])
    return {"tasks": tasks}


# ── Fan-out: one execute_task invocation per planned task, run concurrently ───


def fan_out_tasks(state: AgentState) -> list[Send]:
    return [Send("execute_task", {"task": task}) for task in state["tasks"]]


# ── Node: execute one task (thin wrapper — logic lives in app.executor) ───────


async def execute_task(state: TaskExecutionInput) -> dict:
    result = await run_task(state["task"])
    return {"results": [result]}


# ── Node: respond (calls the LLM, extracts widgets) ───────────────────────────
#
# state["messages"] already holds the full conversation (checkpointer loads
# prior turns; the caller appends only the new HumanMessage before invoking).
# Kept as this exact node name — app/api/v1/run.py's SSE streaming filter matches
# on meta["langgraph_node"] == "respond" to decide which LLM's tokens are user-facing.


async def respond(state: AgentState) -> dict:
    emit_step("respond")
    llm = build_llm(get_settings())

    context_block = ""
    if state.get("results"):
        context_block = f"\n\n--- CONTEXT ---\n{json.dumps(state['results'], indent=2)}"

    base_system = await build_base_system()
    system = base_system + context_block + "\n\n" + WIDGET_INSTRUCTION
    lc_messages = [SystemMessage(content=system), *state["messages"]]

    ai_message = await llm.ainvoke(lc_messages)
    response_text, widgets = parse_widget_block(str(ai_message.content))

    return {"messages": [ai_message], "response": response_text, "widgets": widgets}


# ── Build the graph ────────────────────────────────────────────────────────────


def build_career_graph(checkpointer: BaseCheckpointSaver) -> StateGraph:
    builder = StateGraph(AgentState)

    builder.add_node("plan_tasks", plan_tasks)
    builder.add_node("execute_task", execute_task)
    builder.add_node("respond", respond)

    builder.add_edge(START, "plan_tasks")
    builder.add_conditional_edges("plan_tasks", fan_out_tasks, ["execute_task"])
    builder.add_edge("execute_task", "respond")
    builder.add_edge("respond", END)

    return builder.compile(checkpointer=checkpointer)

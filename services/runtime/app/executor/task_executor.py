"""
Executes one planned Task — the unit of work fanned out to in parallel by the career
graph's execute_task node (see app/graphs/career.py). Kept separate from the graph module
so it's testable without any LangGraph/Send machinery involved: run_task() is a plain
async function over a Task in, a TaskResult out.
"""

from app.core.llm import build_llm
from app.prompts.career import INTENT_HINTS, SUFFICIENCY_SYSTEM_PROMPT, parse_sufficiency
from app.state.agent_state import Task, TaskResult
from app.streaming import emit_step
from app.tools.retrieval import retrieve_context
from core.config import get_settings
from core.logging.setup import get_logger
from langchain_core.messages import HumanMessage, SystemMessage

log = get_logger(__name__)


async def run_task(task: Task) -> TaskResult:
    emit_step("retrieve")
    retrieved = await retrieve_context(task["query"])

    emit_step("verify")
    retrieved = await _verify_and_refine(task, retrieved)

    return {
        "intent": task["intent"],
        "query": task["query"],
        "retrieved": retrieved,
        "hint": INTENT_HINTS[task["intent"]],
    }


async def _verify_and_refine(task: Task, retrieved: str) -> str:
    """check_sufficiency's old judgment logic, scoped to one task. Fails open on ANY
    exception here — not just an unparseable reply — because this runs inside one of N
    parallel Send branches (see execute_task in app/graphs/career.py): an unhandled
    exception would abort the whole turn, including branches that already succeeded,
    which the old single-branch version never had to guard against."""
    try:
        llm = build_llm(get_settings())
        ai_message = await llm.ainvoke(
            [
                SystemMessage(content=SUFFICIENCY_SYSTEM_PROMPT),
                HumanMessage(
                    content=f"Question: {task['query']}\n\n"
                    f"Retrieved context:\n{retrieved or '(nothing retrieved)'}"
                ),
            ]
        )
    except Exception as exc:
        log.warning("sufficiency.check.failed", intent=task["intent"], error=str(exc))
        return retrieved

    sufficient, reformulated_query = parse_sufficiency(str(ai_message.content))
    if sufficient or not reformulated_query:
        return retrieved

    return await retrieve_context(reformulated_query)

"""
Ragas evaluation of the RAG retrieval pipeline (app/tools/retrieval.py).

Includes plan_tasks' query rewrite (app/prompts/career.py's PLAN_SYSTEM_PROMPT) ahead of
retrieval, since that rewrite is what turns vague/superlative phrasing ("most complex
project") into something retrieval can actually match against — skipping it, as an
earlier version of this script did, silently measures a weaker pipeline than what's
actually deployed. Still isolated from the rest of the graph (fan_out_tasks' parallel
execution, the sufficiency-check/reformulate retry loop, respond's final synthesis) —
this is plan_tasks + retrieval + a single grounded-answer call, not the full turn. See
docs/OBSERVABILITY.md for context.

Metrics (no ground-truth reference answers needed for any of these):
  - faithfulness              — is the answer actually grounded in the retrieved context?
  - response_relevancy        — does the answer address the question asked?
  - context_precision (LLM)   — are the retrieved chunks actually relevant to the question?

Run: uv run python evals/ragas_eval.py
"""

import asyncio
import sys
import types

# ragas 0.3.9 unconditionally imports langchain_community.chat_models.vertexai, which
# newer langchain-community releases deleted (upstream bug — see docs/OBSERVABILITY.md).
# We never use VertexAI; this stub just satisfies the import so the rest of ragas loads.
_fake_vertexai = types.ModuleType("langchain_community.chat_models.vertexai")
_fake_vertexai.ChatVertexAI = object
sys.modules["langchain_community.chat_models.vertexai"] = _fake_vertexai

from langchain_core.embeddings import Embeddings  # noqa: E402
from langchain_core.messages import HumanMessage, SystemMessage  # noqa: E402
from ragas import EvaluationDataset, SingleTurnSample, evaluate  # noqa: E402
from ragas.embeddings import LangchainEmbeddingsWrapper  # noqa: E402
from ragas.llms import LangchainLLMWrapper  # noqa: E402
from ragas.metrics import (  # noqa: E402
    Faithfulness,
    LLMContextPrecisionWithoutReference,
    ResponseRelevancy,
)

from app.core.llm import build_llm  # noqa: E402
from app.prompts.career import PLAN_SYSTEM_PROMPT, parse_plan  # noqa: E402
from app.tools.retrieval import retrieve_context  # noqa: E402
from core.config import get_settings  # noqa: E402

# Real questions this app is actually built to answer — see
# frontend/src/lib/questions.ts (FEATURED_QUESTIONS) — not made-up eval-only queries.
QUESTIONS = [
    "Walk me through your most complex project",
    "What's your tech stack?",
    "How deep is your LangGraph experience?",
    "What systems have you built?",
    "Explain your RAG platform architecture",
    "Which tools do you work with daily?",
]

ANSWER_PROMPT = (
    "Answer the question using ONLY the context below. If the context doesn't contain "
    "the answer, say so plainly instead of guessing.\n\nContext:\n{context}\n\n"
    "Question: {question}"
)


def build_embeddings(settings) -> Embeddings:
    """Mirrors app/core/llm.py's build_llm() provider switch, for embeddings — the judge
    embeddings must match whatever EMBEDDING_PROVIDER retrieval itself actually used, or
    this eval silently stops being representative of the real pipeline."""
    provider = settings.embedding_provider.lower()
    if provider == "openai":
        from langchain_openai import OpenAIEmbeddings

        return OpenAIEmbeddings(
            model=settings.embedding_model,
            api_key=settings.openai_api_key.get_secret_value() if settings.openai_api_key else None,
        )
    from langchain_ollama import OllamaEmbeddings

    return OllamaEmbeddings(model=settings.embedding_model, base_url=settings.ollama_base_url)


async def plan_query(llm, question: str) -> str:
    """Same call app/graphs/career.py's plan_tasks node makes — reused here (not
    reimplemented) so the eval exercises the real prompt, not a copy that can drift."""
    ai_message = await llm.ainvoke(
        [SystemMessage(content=PLAN_SYSTEM_PROMPT), HumanMessage(content=question)]
    )
    tasks = parse_plan(str(ai_message.content), fallback_query=question)
    return tasks[0]["query"]  # none of our eval questions are compound -> always 1 task


async def build_sample(llm, question: str) -> SingleTurnSample:
    retrieval_query = await plan_query(llm, question)
    raw_context = await retrieve_context(retrieval_query)
    contexts = [c.strip() for c in raw_context.split("\n\n") if c.strip()]

    response = await llm.ainvoke(
        [
            SystemMessage(content="You are a precise, grounded assistant."),
            HumanMessage(content=ANSWER_PROMPT.format(context=raw_context, question=question)),
        ]
    )

    # user_input stays the ORIGINAL question (what a real user actually asked, for
    # relevancy scoring) even though retrieval used the rewritten retrieval_query.
    return SingleTurnSample(
        user_input=question,
        response=response.content,
        retrieved_contexts=contexts,
    )


async def main() -> None:
    settings = get_settings()
    llm = build_llm(settings)  # generation stays on the real configured provider (Groq)

    samples = await asyncio.gather(*(build_sample(llm, q) for q in QUESTIONS))
    dataset = EvaluationDataset(samples=list(samples))

    # Judge deliberately decoupled from the generation LLM: reusing Groq for both meant
    # every eval run competed with app testing for the same 100k-token/day free-tier
    # quota, and 18 judge calls (3 metrics x 6 questions) exhausted it mid-run last time
    # (see docs/OBSERVABILITY.md). The judge's job — scoring an already-generated answer
    # — has nothing to do with which model generated it, so there's no representativeness
    # cost to using a separate, more reliable model here.
    from langchain_openai import ChatOpenAI

    judge_llm = LangchainLLMWrapper(
        ChatOpenAI(
            model="gpt-4.1-mini",
            api_key=settings.openai_api_key.get_secret_value() if settings.openai_api_key else None,
            temperature=0,
        )
    )
    judge_embeddings = LangchainEmbeddingsWrapper(build_embeddings(settings))

    result = evaluate(
        dataset=dataset,
        metrics=[Faithfulness(), ResponseRelevancy(), LLMContextPrecisionWithoutReference()],
        llm=judge_llm,
        embeddings=judge_embeddings,
    )

    df = result.to_pandas()
    print(df.to_string())
    print("\n--- averages ---")
    print(df.select_dtypes(include="number").mean())


if __name__ == "__main__":
    asyncio.run(main())

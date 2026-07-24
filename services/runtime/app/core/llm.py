"""
LLM provider factory — graph-agnostic. Any graph binds its own tools; this module
only knows how to construct the right chat model for
LLM_PROVIDER=openai|groq|anthropic|ollama. Defaults to openai when unset/unrecognised.
"""

from langchain_core.language_models import BaseChatModel
from langchain_core.tools import BaseTool

from core.config import AppSettings


def build_llm(
    settings: AppSettings, tools: list[BaseTool] | None = None
) -> BaseChatModel:
    provider = settings.llm_provider.lower()

    if provider == "groq":
        from langchain_groq import ChatGroq

        if not settings.groq_api_key:
            raise ValueError("GROQ_API_KEY is required when LLM_PROVIDER=groq")
        llm: BaseChatModel = ChatGroq(
            model=settings.groq_model,
            api_key=settings.groq_api_key.get_secret_value(),
            temperature=settings.llm_temperature,
        )
    elif provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        if not settings.anthropic_api_key:
            raise ValueError(
                "ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic"
            )
        llm = ChatAnthropic(
            model=settings.anthropic_model,
            api_key=settings.anthropic_api_key.get_secret_value(),
            max_tokens=settings.llm_max_tokens,
            temperature=settings.llm_temperature,
        )
    else:
        # Default: openai
        from langchain_openai import ChatOpenAI

        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required when LLM_PROVIDER=openai")
        llm = ChatOpenAI(
            model=settings.openai_model,
            api_key=settings.openai_api_key.get_secret_value(),
            max_tokens=settings.llm_max_tokens,
            temperature=settings.llm_temperature,
        )

    return llm.bind_tools(tools) if tools else llm

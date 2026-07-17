from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.core.llm import build_llm


class _FakeSecret:
    def __init__(self, value):
        self._value = value

    def get_secret_value(self):
        return self._value


def _settings(**overrides):
    defaults = dict(
        llm_provider="anthropic",
        groq_api_key=None,
        groq_model="llama-3.3-70b-versatile",
        anthropic_api_key=None,
        anthropic_model="claude-sonnet-5",
        llm_max_tokens=2048,
        llm_temperature=0.7,
        ollama_base_url="http://localhost:11434",
        ollama_model="llama3.2",
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def test_build_llm_anthropic_branch(monkeypatch):
    fake_llm = MagicMock()
    fake_cls = MagicMock(return_value=fake_llm)
    monkeypatch.setattr("app.core.llm.ChatAnthropic", fake_cls)

    settings = _settings(llm_provider="anthropic", anthropic_api_key=_FakeSecret("sk-ant-test"))

    result = build_llm(settings)

    fake_cls.assert_called_once_with(
        model="claude-sonnet-5", api_key="sk-ant-test", max_tokens=2048, temperature=0.7
    )
    assert result is fake_llm


def test_build_llm_anthropic_missing_key_raises():
    settings = _settings(llm_provider="anthropic", anthropic_api_key=None)

    with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
        build_llm(settings)


def test_build_llm_groq_branch(monkeypatch):
    fake_llm = MagicMock()
    fake_cls = MagicMock(return_value=fake_llm)
    monkeypatch.setattr("langchain_groq.ChatGroq", fake_cls)

    settings = _settings(llm_provider="groq", groq_api_key=_FakeSecret("gsk-test"))

    result = build_llm(settings)

    fake_cls.assert_called_once_with(
        model="llama-3.3-70b-versatile", api_key="gsk-test", temperature=0.7
    )
    assert result is fake_llm


def test_build_llm_groq_missing_key_raises():
    settings = _settings(llm_provider="groq", groq_api_key=None)

    with pytest.raises(ValueError, match="GROQ_API_KEY"):
        build_llm(settings)


def test_build_llm_ollama_branch(monkeypatch):
    fake_llm = MagicMock()
    fake_cls = MagicMock(return_value=fake_llm)
    monkeypatch.setattr("langchain_ollama.ChatOllama", fake_cls)

    settings = _settings(llm_provider="ollama")

    result = build_llm(settings)

    fake_cls.assert_called_once_with(
        model="llama3.2", base_url="http://localhost:11434", temperature=0.7
    )
    assert result is fake_llm


def test_build_llm_binds_tools_when_provided(monkeypatch):
    fake_llm = MagicMock()
    fake_llm.bind_tools.return_value = "bound-llm"
    fake_cls = MagicMock(return_value=fake_llm)
    monkeypatch.setattr("app.core.llm.ChatAnthropic", fake_cls)

    settings = _settings(llm_provider="anthropic", anthropic_api_key=_FakeSecret("sk-ant-test"))
    tools = [MagicMock()]

    result = build_llm(settings, tools)

    fake_llm.bind_tools.assert_called_once_with(tools)
    assert result == "bound-llm"


def test_build_llm_no_tools_returns_unbound_llm(monkeypatch):
    fake_llm = MagicMock()
    fake_cls = MagicMock(return_value=fake_llm)
    monkeypatch.setattr("app.core.llm.ChatAnthropic", fake_cls)

    settings = _settings(llm_provider="anthropic", anthropic_api_key=_FakeSecret("sk-ant-test"))

    result = build_llm(settings, tools=None)

    fake_llm.bind_tools.assert_not_called()
    assert result is fake_llm

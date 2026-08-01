"""LLM provider abstraction.

The bugfixer agent talks to language models exclusively through
`LLMProvider`. `GroqProvider` is the first concrete implementation
(backed by langchain-groq's `ChatGroq`); additional providers
(OpenAI, Anthropic, Gemini, Ollama, OpenRouter, ...) only need a new
subclass and never touch the graph logic.
"""

from __future__ import annotations

import os
from abc import ABC, abstractmethod
from typing import Any, Optional

__all__ = ["LLMProvider", "GroqProvider"]


class LLMProvider(ABC):
    """Minimal interface every language model backend must implement."""

    @abstractmethod
    def chat(self, messages: list[dict[str, str]]) -> str:
        """Return the model's reply for a chat-style message list.

        Each message is a dict with keys ``role`` ("system" | "user" |
        "assistant" | "tool") and ``content`` (the message text).
        """


class GroqProvider(LLMProvider):
    """Groq-backed LLM provider (thin wrapper around langchain-groq)."""

    def __init__(self, model: str, api_key: Optional[str] = None) -> None:
        self.model = model
        self.api_key = api_key if api_key is not None else os.environ.get("GROQ_API_KEY")
        if not self.api_key:
            raise ValueError(
                "GROQ_API_KEY is required (pass api_key= or set the environment variable)"
            )
        try:
            from langchain_groq import ChatGroq
        except ImportError as exc:  # pragma: no cover - import guard
            raise ImportError(
                "langchain-groq is not installed; run: pip install langchain-groq"
            ) from exc
        self._client: Any = ChatGroq(model=model, api_key=self.api_key, temperature=0)
        self.tokens_in: Optional[int] = None
        self.tokens_out: Optional[int] = None

    def chat(self, messages: list[dict[str, str]]) -> str:
        prompt = "\n\n".join(f"{m['role']}: {m['content']}" for m in messages)
        response = self._client.invoke(prompt)
        usage = getattr(response, "usage_metadata", None) or {}
        if isinstance(usage, dict):
            self.tokens_in = usage.get("input_tokens") or self.tokens_in
            self.tokens_out = usage.get("output_tokens") or self.tokens_out
        return str(response.content)

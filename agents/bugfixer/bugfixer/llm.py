"""LLM provider abstraction.

The bugfixer agent talks to language models exclusively through
`LLMProvider`. `GroqProvider` is the first concrete implementation
(backed by langchain-groq's `ChatGroq`); additional providers
(OpenAI, Anthropic, Gemini, Ollama, OpenRouter, ...) only need a new
subclass and never touch the graph logic.
"""

from __future__ import annotations

import os
import time
from abc import ABC, abstractmethod
from typing import Any, Optional

__all__ = ["LLMProvider", "GroqProvider"]

_RATE_LIMIT_RETRIES = 4
_RATE_LIMIT_BACKOFF_SEC = 15


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
        self._client: Any = ChatGroq(
            model=model, api_key=self.api_key, temperature=0, max_tokens=1024
        )
        self.tokens_in: Optional[int] = None
        self.tokens_out: Optional[int] = None

    def chat(self, messages: list[dict[str, str]]) -> str:
        prompt = "\n\n".join(f"{m['role']}: {m['content']}" for m in messages)
        for attempt in range(_RATE_LIMIT_RETRIES):
            try:
                response = self._client.invoke(prompt)
                break
            except Exception as exc:
                if _is_retryable_rate_limit(exc) and attempt < _RATE_LIMIT_RETRIES - 1:
                    time.sleep(_RATE_LIMIT_BACKOFF_SEC * (attempt + 1))
                    continue
                raise
        usage = getattr(response, "usage_metadata", None) or {}
        if isinstance(usage, dict):
            self.tokens_in = usage.get("input_tokens") or self.tokens_in
            self.tokens_out = usage.get("output_tokens") or self.tokens_out
        return str(response.content)


def _is_retryable_rate_limit(exc: Exception) -> bool:
    """True for Groq 429 (per-minute rate limit); 413 (request too large)
    is permanent for the same prompt and would only waste retries."""
    status = getattr(getattr(exc, "response", None), "status_code", None)
    if status == 429:
        return True
    code = getattr(exc, "code", None)
    return code == "rate_limit_exceeded"

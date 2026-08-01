"""Shared test doubles: fake StratScope execution and canned LLM provider."""

import subprocess

from bugfixer.llm import LLMProvider


class FakeExecution:
    """Stands in for a stratscope StratScopeExecution; records event()/finish()."""

    def __init__(self, execution_id: str = "exec_test_123") -> None:
        self.id = execution_id
        self.events = []
        self.finish_called = None

    def event(self, event_type: str, payload: dict, metadata: dict | None = None) -> None:
        self.events.append({"type": event_type, "payload": payload, "metadata": metadata})

    def finish(self, **kwargs) -> None:
        self.finish_called = kwargs

    @property
    def types(self) -> list[str]:
        return [e["type"] for e in self.events]


class FakeStratScope:
    """Stands in for the `stratscope` SDK module."""

    def __init__(self) -> None:
        self.started = []
        self.last: FakeExecution | None = None

    def start(self, **kwargs) -> FakeExecution:
        self.started.append(kwargs)
        self.last = FakeExecution()
        return self.last


class CannedLLM(LLMProvider):
    """Returns a canned reply per call; accepts the GroqProvider constructor kwargs."""

    def __init__(
        self,
        replies: list[str],
        model: str | None = None,
        api_key: str | None = None,
        tokens_in: int | None = 10,
        tokens_out: int | None = 20,
    ) -> None:
        self.replies = list(replies)
        self.calls = 0
        self.tokens_in = tokens_in
        self.tokens_out = tokens_out

    def chat(self, messages: list[dict]) -> str:
        self.calls += 1
        return self.replies.pop(0) if self.replies else "DONE"


def init_git_repo(path) -> None:
    subprocess.run("git init", cwd=path, shell=True, check=True, capture_output=True, text=True)
    subprocess.run(
        "git -c user.name=test -c user.email=test@test.local commit -m init --allow-empty",
        cwd=path,
        shell=True,
        check=True,
        capture_output=True,
        text=True,
    )

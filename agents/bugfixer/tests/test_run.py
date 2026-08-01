"""End-to-end CLI tests for bugfixer.run with a stubbed stratscope SDK."""

import json
import os
import sys

from bugfixer import run as run_mod

from stubs import CannedLLM, FakeStratScope, init_git_repo


def _tool_call(tool, args):
    return json.dumps({"tool": tool, "args": args})


class WorkingLLM(CannedLLM):
    """Canned provider used in place of GroqProvider by main()."""

    def __init__(self, model=None, api_key=None):
        super().__init__(
            [
                "Root cause: missing empty-input guard.",
                "1. Add a guard.\n2. Verify it compiles.",
                _tool_call("write_file", {"path": "bug.py", "content": "x = 1\n"}),
                "DONE",
                "Added the missing guard.",
            ],
            model=model,
            api_key=api_key,
        )


def test_main_successful_run(tmp_path, monkeypatch, capsys):
    init_git_repo(tmp_path)
    monkeypatch.setenv("STRATSCOPE_API_KEY", "sk-test")
    monkeypatch.setenv("STRATSCOPE_PROJECT_ID", "proj_test")
    monkeypatch.setenv("STRATSCOPE_AGENT_ID", "agent_test")
    monkeypatch.setenv("GROQ_API_KEY", "gsk-test")
    monkeypatch.setenv("LLM_MODEL", "qwen3-coder-480b")

    fake_sdk = FakeStratScope()
    monkeypatch.setitem(sys.modules, "stratscope", fake_sdk)
    monkeypatch.setattr(run_mod, "GroqProvider", WorkingLLM)

    rc = run_mod.main(
        [
            "--workdir",
            str(tmp_path),
            "--title",
            "Crash on empty input",
            "--body",
            "Agent crashes when input is empty.",
        ]
    )

    assert rc == 0
    out = json.loads(capsys.readouterr().out)
    assert out["execution_id"] == "exec_test_123"
    assert out["status"] == "completed"
    assert out["tests_passed"] is True
    assert out["changes"] == 1

    start_kwargs = fake_sdk.started[0]
    assert start_kwargs["api_key"] == "sk-test"
    assert start_kwargs["base_url"] == run_mod.DEFAULT_BASE_URL
    assert start_kwargs["project_id"] == "proj_test"
    assert start_kwargs["agent_id"] == "agent_test"
    assert start_kwargs["model"] == "qwen3-coder-480b"
    assert start_kwargs["provider"] == "groq"
    assert start_kwargs["metadata"] == {
        "issue_title": "Crash on empty input",
        "workdir": os.path.abspath(str(tmp_path)),
    }

    assert fake_sdk.last is not None
    assert fake_sdk.last.finish_called["status"] == "completed"
    assert fake_sdk.last.finish_called["latency_ms"] is not None
    assert fake_sdk.last.finish_called["tokens_in"] == 10
    assert fake_sdk.last.finish_called["tokens_out"] == 20
    assert fake_sdk.last.finish_called["error"] is None


def test_main_missing_env_fails_fast(tmp_path, monkeypatch, capsys):
    monkeypatch.delenv("STRATSCOPE_API_KEY", raising=False)
    monkeypatch.delenv("STRATSCOPE_PROJECT_ID", raising=False)
    monkeypatch.delenv("STRATSCOPE_AGENT_ID", raising=False)
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    rc = run_mod.main(["--workdir", str(tmp_path), "--title", "t", "--body", "b"])
    assert rc == 2
    err = capsys.readouterr().err
    assert "missing environment variables" in err
    assert "STRATSCOPE_AGENT_ID" in err


def test_main_missing_workdir_fails(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("STRATSCOPE_API_KEY", "sk-test")
    monkeypatch.setenv("STRATSCOPE_PROJECT_ID", "proj_test")
    monkeypatch.setenv("STRATSCOPE_AGENT_ID", "agent_test")
    monkeypatch.setenv("GROQ_API_KEY", "gsk-test")
    monkeypatch.setitem(sys.modules, "stratscope", FakeStratScope())
    monkeypatch.setattr(run_mod, "GroqProvider", WorkingLLM)
    rc = run_mod.main(["--workdir", str(tmp_path / "missing"), "--title", "t", "--body", "b"])
    assert rc == 2
    assert "workdir does not exist" in capsys.readouterr().err

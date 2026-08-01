"""Graph tests with a canned LLM and a fake StratScope execution (no network)."""

import json

import pytest

from bugfixer import graph, tools

from stubs import CannedLLM, FakeExecution, init_git_repo


def _initial_state(workdir, title="Fix crash on empty input", body="Agent crashes when input is empty"):
    return {
        "issue_title": title,
        "issue_body": body,
        "workdir": str(workdir),
        "messages": [],
        "changes": [],
        "tests_passed": False,
    }


def _tool_call(tool, args):
    return json.dumps({"tool": tool, "args": args})


def test_graph_happy_path_reaches_commit_and_report(tmp_path):
    init_git_repo(tmp_path)
    fake = FakeExecution()
    llm = CannedLLM(
        [
            "Root cause: missing guard for empty input in main().",
            "1. Add a guard clause in main().\n2. Verify the module compiles.",
            _tool_call("write_file", {"path": "bug.py", "content": "x = 1\n"}),
            "DONE",
            "Fixed by adding a guard clause.",
        ]
    )
    graph.set_context(execution=fake, provider=llm)

    result = graph.run_graph(_initial_state(tmp_path))

    assert result["tests_passed"] is True
    assert len(result["changes"]) == 1
    assert result["changes"][0]["tool"] == "write_file"
    assert result["final_report"] == "Fixed by adding a guard clause."
    assert graph.GRAPH_BACKEND == "langgraph"

    for expected in (
        "agent.analyze",
        "agent.plan",
        "agent.edit",
        "agent.tool_call",
        "agent.tool_result",
        "agent.test",
        "agent.commit",
        "agent.report",
    ):
        assert expected in fake.types, f"missing {expected} in {fake.types}"

    assert fake.types.count("agent.tool_call") == 1
    tool_event = next(e for e in fake.events if e["type"] == "agent.tool_call")
    assert tool_event["payload"]["tool"] == "write_file"
    commit_event = next(e for e in fake.events if e["type"] == "agent.commit")
    assert commit_event["payload"]["committed"] is True
    assert commit_event["payload"]["message"] == "Fix: Fix crash on empty input"

    log, code = tools.run_command("git log -1 --oneline", str(tmp_path))
    assert code == 0
    assert "Fix: Fix crash on empty input" in log


def test_graph_failed_tests_skip_commit(tmp_path):
    init_git_repo(tmp_path)
    fake = FakeExecution()
    llm = CannedLLM(
        [
            "Root cause analysis.",
            "1. plan step",
            _tool_call("write_file", {"path": "broken.py", "content": "def broken(:\n"}),
            "DONE",
            "report text",
        ]
    )
    graph.set_context(execution=fake, provider=llm)

    result = graph.run_graph(_initial_state(tmp_path))

    assert result["tests_passed"] is False
    assert result["final_report"] == "report text"
    commit_event = next(e for e in fake.events if e["type"] == "agent.commit")
    assert commit_event["payload"]["committed"] is False
    assert "agent.report" in fake.types


def test_graph_unknown_tool_is_surfaced_without_crashing(tmp_path):
    init_git_repo(tmp_path)
    fake = FakeExecution()
    llm = CannedLLM(
        [
            "analysis",
            "plan",
            _tool_call("bogus_tool", {"x": 1}),
            _tool_call("write_file", {"path": "ok.py", "content": "x = 1\n"}),
            "DONE",
            "report",
        ]
    )
    graph.set_context(execution=fake, provider=llm)

    result = graph.run_graph(_initial_state(tmp_path))

    assert result["tests_passed"] is True
    error_result = next(
        e for e in fake.events if e["type"] == "agent.tool_result" and e["payload"]["tool"] == "bogus_tool"
    )
    assert "unknown tool" in error_result["payload"]["result_summary"]
    assert len(result["changes"]) == 1


def test_graph_context_required_raises(tmp_path):
    graph.set_context(execution=None, provider=None)
    fake = FakeExecution()
    graph.set_context(execution=fake, provider=None)
    with pytest.raises(RuntimeError):
        graph.run_graph(_initial_state(tmp_path))
    graph.set_context(execution=None, provider=None)


def test_graph_rejects_list_files_and_repeated_calls(tmp_path):
    init_git_repo(tmp_path)
    fake = FakeExecution()
    llm = CannedLLM(
        [
            "analysis",
            "plan",
            _tool_call("list_files", {}),
            _tool_call("list_files", {}),
            _tool_call("read_file", {"path": "bug.py"}),
            _tool_call("write_file", {"path": "bug.py", "content": "x = 1\n"}),
            "DONE",
            "report",
        ]
    )
    graph.set_context(execution=fake, provider=llm)

    result = graph.run_graph(_initial_state(tmp_path))

    assert result["tests_passed"] is True
    assert len(result["changes"]) == 1
    list_results = [
        e
        for e in fake.events
        if e["type"] == "agent.tool_result" and e["payload"]["tool"] == "list_files"
    ]
    assert len(list_results) == 2
    assert "not available in this phase" in list_results[0]["payload"]["result_summary"]
    assert "Stop repeating calls" in list_results[1]["payload"]["result_summary"]


def test_graph_edit_context_includes_repo_listing(tmp_path):
    init_git_repo(tmp_path)
    fake = FakeExecution()
    llm = CannedLLM(
        [
            "analysis",
            "plan",
            _tool_call("write_file", {"path": "bug.py", "content": "x = 1\n"}),
            "DONE",
            "report",
        ]
    )
    graph.set_context(execution=fake, provider=llm)

    graph.run_graph(_initial_state(tmp_path))

    edit_user_message = llm.calls_log[2][1]["content"]
    assert "Repository layout (truncated)" in edit_user_message
    assert "list_files is NOT available" in llm.calls_log[2][0]["content"]

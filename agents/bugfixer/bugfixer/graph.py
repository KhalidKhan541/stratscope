"""LangGraph state machine for the bugfixer agent.

Pipeline::

    analyze -> plan -> edit -> test -> commit -> report

Every node emits an ``agent.<node>`` event on the StratScope execution
object held in module-level context (see ``set_context``). The LLM drives
tool calls in the ``edit`` node through the JSON tool protocol documented
in the README.

If langgraph is not installed, ``run_graph`` falls back to a minimal
in-process runner that executes the same nodes in the same order.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List, Optional, Set, TypedDict, Tuple

from . import tools as tools_mod
from .llm import LLMProvider

__all__ = [
    "BugFixState",
    "GRAPH_BACKEND",
    "MAX_EDIT_ITERATIONS",
    "set_context",
    "run_graph",
    "build_graph",
]

NODE_ANALYZE = "analyze"
NODE_PLAN = "plan"
NODE_EDIT = "edit"
NODE_TEST = "test"
NODE_COMMIT = "commit"
NODE_REPORT = "report"


class BugFixState(TypedDict, total=False):
    """Graph state shared between nodes."""

    issue_title: str
    issue_body: str
    workdir: str
    messages: List[Dict[str, str]]
    analysis: str
    plan: str
    changes: List[Dict[str, str]]
    tests_passed: bool
    final_report: str


_CONTEXT: Dict[str, Any] = {"execution": None, "provider": None}

# Which backend actually executed the last run: "langgraph" or "fallback".
GRAPH_BACKEND: str = "unknown"

MAX_EDIT_ITERATIONS = 10

MAX_TOOL_RESULT_CHARS = 1200
MAX_LISTING_CHARS = 3000
MAX_EDIT_HISTORY_MESSAGES = 6

SYSTEM_PROMPT = (
    "You are the StratScope bugfixer, an autonomous agent that fixes bugs in a "
    "repository. Every reply must be either:\n"
    "1. A tool call: a single JSON object (optionally fenced in ```json ... ```):\n"
    '   {"tool": "<name>", "args": {...}}\n'
    "2. The final answer: exactly the word DONE (when the fix is complete).\n\n"
    "Available tools and their args:\n"
    '- read_file    {"path": "relative/path.py"}\n'
    '- write_file   {"path": "relative/path.py", "content": "..."}\n'
    '- run_command  {"cmd": "shell command"}\n'
    "- git_status   {}\n"
    '- git_commit   {"message": "commit message"}\n\n'
    "All paths are relative to the repository root. The repository layout is "
    "already provided in your instructions; list_files is NOT available. After "
    "each tool call you will receive the tool result. Inspect the code, apply "
    "the fix, then reply exactly DONE. Prefer minimal changes to the fewest files."
)


def set_context(*, execution: Any = None, provider: Optional[LLMProvider] = None) -> None:
    """Point the graph at the StratScope execution and LLM provider for this run."""
    _CONTEXT["execution"] = execution
    _CONTEXT["provider"] = provider


def _execution() -> Any:
    execution = _CONTEXT.get("execution")
    if execution is None:
        raise RuntimeError(
            "bugfixer graph context not set; call bugfixer.graph.set_context(execution=...)"
        )
    return execution


def _provider() -> LLMProvider:
    provider = _CONTEXT.get("provider")
    if provider is None:
        raise RuntimeError(
            "bugfixer graph context not set; call bugfixer.graph.set_context(provider=...)"
        )
    return provider


def _append(state: dict, role: str, content: str) -> None:
    state["messages"] = state.get("messages", []) + [{"role": role, "content": content}]


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------

def analyze(state: dict) -> dict:
    """LLM reads the issue and produces an analysis of the bug and location."""
    execution = _execution()
    provider = _provider()
    title = state.get("issue_title", "")
    body = state.get("issue_body", "")
    user = (
        f"Repository issue to fix:\nTitle: {title}\nBody:\n{body}\n\n"
        "Produce a concise analysis of the bug: the root cause and the files "
        "most likely involved. Return only the analysis text."
    )
    reply = provider.chat(
        [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user}]
    ).strip()
    state["analysis"] = reply
    _append(state, "assistant", reply)
    execution.event("agent.analyze", {"analysis": reply})
    return state


def plan(state: dict) -> dict:
    """LLM reads the repo listing and produces a numbered fix plan."""
    execution = _execution()
    provider = _provider()
    listing = tools_mod.list_files(state["workdir"])
    user = (
        f"Current repository files:\n{listing}\n\n"
        f"Analysis:\n{state.get('analysis', '')}\n\n"
        "Produce a numbered fix plan (max 8 steps). Return only the plan."
    )
    reply = provider.chat(
        [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user}]
    ).strip()
    state["plan"] = reply
    state["listing"] = listing
    _append(state, "assistant", reply)
    execution.event("agent.plan", {"plan": reply})
    return state


def is_done(reply: str) -> bool:
    """True when the LLM reply signals the edit loop should stop."""
    stripped = reply.strip()
    return stripped.splitlines()[0].strip().upper() == "DONE" if stripped else False


_TOOL_CALL_RE = re.compile(r"\{.*\}", re.DOTALL)


def parse_tool_call(reply: str) -> Optional[Tuple[str, dict]]:
    """Extract ``{"tool": ..., "args": {...}}`` from an LLM reply."""
    match = _TOOL_CALL_RE.search(reply)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict) or "tool" not in data:
        return None
    args = data.get("args")
    return str(data["tool"]), args if isinstance(args, dict) else {}


_TOOL_HANDLERS = {
    "read_file": lambda args, wd: tools_mod.read_file(str(args.get("path", "")), wd),
    "list_files": lambda args, wd: tools_mod.list_files(wd),
    "write_file": lambda args, wd: tools_mod.write_file(
        str(args.get("path", "")), str(args.get("content", "")), wd
    ),
    "run_command": lambda args, wd: tools_mod.run_command_text(str(args.get("cmd", "")), wd),
    "git_status": lambda args, wd: tools_mod.git_status(wd),
    "git_commit": lambda args, wd: tools_mod.git_commit(str(args.get("message", "")), wd),
}

# Tools that change the repository and therefore count as "changes".
_MUTATING_TOOLS = {"write_file", "run_command", "git_commit"}


def _dispatch(tool: str, args: dict, workdir: str) -> str:
    if tool not in _TOOL_HANDLERS:
        return (
            f"ERROR: unknown tool '{tool}'. "
            f"Available tools: {', '.join(sorted(_TOOL_HANDLERS))}"
        )
    try:
        return _TOOL_HANDLERS[tool](args, workdir)
    except Exception as exc:  # keep the loop alive; surface the error to the LLM
        return f"ERROR: tool '{tool}' failed: {exc}"


def _truncate_result(result: str, tool: str) -> str:
    limit = MAX_LISTING_CHARS if tool == "list_files" else MAX_TOOL_RESULT_CHARS
    if len(result) <= limit:
        return result
    return (
        result[:limit]
        + "\n...[truncated; use read_file on a specific file to see its contents]"
    )


def edit(state: dict) -> dict:
    """LLM-driven tool loop: apply the fix, at most MAX_EDIT_ITERATIONS calls."""
    execution = _execution()
    provider = _provider()
    context_user = (
        f"Implement the fix in the repository at {state['workdir']}.\n\n"
        f"Repository layout (truncated):\n{state.get('listing', '')[:MAX_LISTING_CHARS]}\n\n"
        f"Analysis:\n{state.get('analysis', '')}\n\n"
        f"Plan:\n{state.get('plan', '')}\n\n"
        "Use the tools until the fix is complete, then reply exactly DONE."
    )
    history = state.get("messages", [])[-MAX_EDIT_HISTORY_MESSAGES:]
    messages: List[Dict[str, str]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": context_user},
    ] + history

    iterations = 0
    seen_calls: Set[Tuple[str, str]] = set()
    for _ in range(MAX_EDIT_ITERATIONS):
        iterations += 1
        reply = provider.chat(messages).strip()
        messages = messages + [{"role": "assistant", "content": reply}]
        if is_done(reply):
            break
        call = parse_tool_call(reply)
        if call is None:
            messages = messages + [
                {
                    "role": "tool",
                    "content": (
                        "ERROR: reply was not a valid tool call. Reply with a single "
                        'JSON object {"tool": ..., "args": {...}} or exactly DONE.'
                    ),
                }
            ]
            continue
        tool, args = call
        call_key = (tool, str(args))
        execution.event("agent.tool_call", {"tool": tool, "args_summary": str(args)[:500]})
        reject: Optional[str] = None
        if call_key in seen_calls:
            reject = (
                f"ERROR: you already called {tool} with these exact arguments. "
                "Stop repeating calls. Apply the fix with write_file, verify with "
                "run_command, then reply exactly DONE. If you truly cannot proceed, "
                "reply exactly DONE."
            )
        elif tool == "list_files":
            reject = (
                "ERROR: list_files is not available in this phase. The repository "
                "layout is already in your context above. Read the files you need "
                "with read_file using relative paths (for example "
                "scripts/seed_bugs/tests/test_seed.py), then write the fix with "
                "write_file and verify with run_command."
            )
        if reject is not None:
            seen_calls.add(call_key)
            result = reject
        else:
            seen_calls.add(call_key)
            result = _dispatch(tool, args, state["workdir"])
            if tool in _MUTATING_TOOLS:
                state["changes"] = state.get("changes", []) + [
                    {"tool": tool, "args_summary": str(args)[:500]}
                ]
        execution.event("agent.tool_result", {"tool": tool, "result_summary": str(result)[:500]})
        messages = messages + [
            {"role": "tool", "content": _truncate_result(result, tool)}
        ]
        messages = messages[:2] + messages[2:][-MAX_EDIT_HISTORY_MESSAGES:]

    state["messages"] = messages[2:]
    execution.event("agent.edit", {"iterations": iterations})
    return state


def _has_tests(workdir: str) -> bool:
    for entry in os.listdir(workdir):
        full = os.path.join(workdir, entry)
        if entry in ("tests", "test") and os.path.isdir(full):
            return True
        if entry.startswith("test_") or entry.endswith("_test.py"):
            return True
    return False


def _python_files(workdir: str) -> List[str]:
    found: List[str] = []
    for root, dirs, files in os.walk(workdir):
        dirs[:] = [d for d in dirs if d not in tools_mod.SKIP_DIRS]
        for name in files:
            if name.endswith(".py"):
                found.append(os.path.join(root, name))
    return found


def _quote(path: str) -> str:
    return f'"{path}"' if " " in path else path


def test(state: dict) -> dict:
    """Run the test suite (or py_compile when no tests exist)."""
    execution = _execution()
    workdir = state["workdir"]
    if _has_tests(workdir):
        command = "python -m pytest -q"
    else:
        py_files = _python_files(workdir)
        if not py_files:
            state["tests_passed"] = True
            execution.event(
                "agent.test",
                {
                    "command": "(none)",
                    "exit_code": 0,
                    "output_tail": "no tests and no python files found",
                },
            )
            return state
        command = "python -m py_compile " + " ".join(_quote(p) for p in py_files)
    out, code = tools_mod.run_command(command, workdir)
    state["tests_passed"] = code == 0
    execution.event(
        "agent.test", {"command": command, "exit_code": code, "output_tail": out[-1000:]}
    )
    return state


def commit(state: dict) -> dict:
    """Commit the fix when there are changes and tests passed."""
    execution = _execution()
    message = f"Fix: {state.get('issue_title', '')[:50]}"
    result = ""
    committed = False
    if state.get("changes") and state.get("tests_passed"):
        result = tools_mod.git_commit(message, state["workdir"])
        committed = not result.startswith("ERROR") and "nothing to commit" not in result
    execution.event("agent.commit", {"message": message, "committed": committed, "result": result[:500]})
    return state


def report(state: dict) -> dict:
    """LLM writes the final human-readable report."""
    execution = _execution()
    provider = _provider()
    changes = state.get("changes", [])
    change_summary = "\n".join(f"- {c['tool']}: {c['args_summary']}" for c in changes) or "- (no changes)"
    user = (
        "Write the final report for the bug fix. Include the root cause, what "
        "was changed, and the test result.\n\n"
        f"Analysis:\n{state.get('analysis', '')}\n\n"
        f"Plan:\n{state.get('plan', '')}\n\n"
        f"Changes:\n{change_summary}\n\n"
        f"Tests passed: {state.get('tests_passed', False)}\n\n"
        "Return only the report text."
    )
    reply = provider.chat(
        [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user}]
    ).strip()
    state["final_report"] = reply
    execution.event("agent.report", {"report": reply})
    return state


# ---------------------------------------------------------------------------
# Graph wiring
# ---------------------------------------------------------------------------

NODES: List[Tuple[str, Any]] = [
    (NODE_ANALYZE, analyze),
    (NODE_PLAN, plan),
    (NODE_EDIT, edit),
    (NODE_TEST, test),
    (NODE_COMMIT, commit),
    (NODE_REPORT, report),
]


def build_graph():
    """Compile the LangGraph StateGraph (requires langgraph installed)."""
    from langgraph.graph import END, START, StateGraph

    graph = StateGraph(BugFixState)
    for name, node in NODES:
        graph.add_node(name, node)
    previous = START
    for name, _node in NODES:
        graph.add_edge(previous, name)
        previous = name
    graph.add_edge(previous, END)
    return graph.compile()


def _fallback_run(initial: dict) -> dict:
    """Minimal in-process runner used when langgraph is unavailable."""
    state = dict(initial)
    for _name, node in NODES:
        state.update(node(dict(state)))
    return state


def run_graph(initial: dict) -> dict:
    """Execute the pipeline over ``initial`` state and return the final state."""
    global GRAPH_BACKEND
    try:
        compiled = build_graph()
    except ImportError:
        GRAPH_BACKEND = "fallback"
        return _fallback_run(initial)
    GRAPH_BACKEND = "langgraph"
    return compiled.invoke(dict(initial))

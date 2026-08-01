# StratScope Bugfixer

A LangGraph-based agent that fixes GitHub issues inside a repository and records
**every step it takes** as StratScope EIOS telemetry via the Python SDK.

Every node of the pipeline emits an immutable `agent.<node>` event; every LLM
tool call emits `agent.tool_call` / `agent.tool_result` events. Nothing is
silent, nothing is lost.

---

## Architecture

```
issue (title + body)
        │
        ▼
┌───────────────┐  LLM reads the issue → analysis of root cause + likely files
│   analyze     │  event: agent.analyze
└───────────────┘
        │
        ▼
┌───────────────┐  LLM reads the repo listing → numbered fix plan
│    plan       │  event: agent.plan
└───────────────┘
        │
        ▼
┌───────────────┐  LLM-driven tool loop (max 10 iterations):
│    edit       │  each reply is a tool call (JSON protocol) or "DONE"
└───────────────┘  events: agent.edit, agent.tool_call, agent.tool_result
        │
        ▼
┌───────────────┐  python -m pytest -q  (if a test dir/test files exist)
│    test       │  python -m py_compile (otherwise)
└───────────────┘  event: agent.test → sets tests_passed
        │
        ▼
┌───────────────┐  git_commit("Fix: <title>") if changes AND tests passed
│    commit     │  event: agent.commit
└───────────────┘
        │
        ▼
┌───────────────┐  LLM writes the final human-readable report
│    report     │  event: agent.report
└───────────────┘
        │
        ▼
  execution.finish(status=completed|failed, latency_ms, tokens_in/out)
```

- **Graph**: `langgraph` `StateGraph` over a `TypedDict` state
  (`issue_title`, `issue_body`, `workdir`, `messages`, `analysis`, `plan`,
  `changes`, `tests_passed`, `final_report`). If langgraph is unavailable,
  `run_graph` transparently falls back to a minimal in-process runner with the
  same nodes and events (`graph.GRAPH_BACKEND` reports which backend ran).
- **Context**: the StratScope execution object and the LLM provider are set
  via `bugfixer.graph.set_context(execution=..., provider=...)` before running.
- **LLM abstraction**: `LLMProvider` (ABC) in `bugfixer/llm.py`; the only
  implementation today is `GroqProvider` (thin wrapper over `langchain-groq`'s
  `ChatGroq`). Future providers (OpenAI, Anthropic, Gemini, Ollama,
  OpenRouter) are just new subclasses — no graph changes.
- **Tools**: plain Python functions in `bugfixer/tools.py` that operate inside
  `workdir` and refuse to escape it (see table below).

### Tool protocol (JSON)

During the `edit` loop the LLM's reply must be one of:

1. A tool call — a single JSON object (optionally fenced in ` ```json ... ``` `):

   ```json
   {"tool": "write_file", "args": {"path": "src/main.py", "content": "..."}}
   ```

2. The word `DONE` (on its own line) — signals the fix is complete.

| Tool         | Args                         | Effect                                             |
| ------------ | ---------------------------- | -------------------------------------------------- |
| `read_file`  | `path`                       | Return a file's contents (relative path)           |
| `list_files` | —                            | Sorted listing of repo files                       |
| `write_file` | `path`, `content`            | Write a file (creates parent dirs)                 |
| `run_command`| `cmd`                        | Run a shell command in the repo (120 s timeout)    |
| `git_status` | —                            | `git status --short` output                        |
| `git_commit` | `message`                    | Stage all + commit (inline git identity)           |

`run_command` returns `(stdout, exit_code)` programmatically;
`run_command_text` formats it as a plain string for the LLM. Malformed
replies and unknown tools are reported back to the LLM as `ERROR: ...`
strings and the loop continues.

---

## Environment variables

| Variable              | Required | Default                                          | Purpose                              |
| --------------------- | -------- | ------------------------------------------------ | ------------------------------------ |
| `STRATSCOPE_API_KEY`  | yes      | —                                                | StratScope SDK API key               |
| `STRATSCOPE_BASE_URL` | no       | `https://stratscope-api.khalidkhan.workers.dev`  | StratScope API base URL              |
| `STRATSCOPE_PROJECT_ID`| yes     | —                                                | Project for telemetry                |
| `STRATSCOPE_AGENT_ID` | yes      | —                                                | Agent identity for telemetry         |
| `GROQ_API_KEY`        | yes      | —                                                | Groq API key for the LLM             |
| `LLM_MODEL`           | no       | `qwen3-coder-480b`                               | Groq model used for all LLM calls    |

`LLM_MODEL` is configurable and can be swapped to e.g.
`llama-3.3-70b-versatile`:

```powershell
$env:LLM_MODEL = "llama-3.3-70b-versatile"
```

---

## Install & run

```powershell
cd agents/bugfixer
python -m venv .venv
.\.venv\Scripts\python -m pip install -e . -e ..\..\sdk\python pytest -q

$env:STRATSCOPE_API_KEY = "ssk_..."
$env:STRATSCOPE_PROJECT_ID = "proj_..."
$env:STRATSCOPE_AGENT_ID = "agent_..."
$env:GROQ_API_KEY = "gsk_..."

.\.venv\Scripts\python -m bugfixer.run --workdir ..\..\apps\api --title "Fix crash on empty input" --body "Agent crashes when input is empty"
```

Output (stdout, JSON):

```json
{"execution_id": "...", "status": "completed", "tests_passed": true, "changes": 3}
```

Exit code `0` = completed, `1` = failed (tests did not pass), `2` = usage /
environment error.

> The `stratscope` SDK is installed explicitly with `-e ..\..\sdk\python` in
> the command above (it is also available as an extra:
> `pip install -e .[telemetry]`, which pulls `stratscope @ file:../../sdk/python`).
> `run.py` only imports the SDK at runtime and errors clearly if it is missing.
> Note: `file://../../sdk/python` (double slash) is NOT usable as a PEP 508
> dependency on Windows — pip 26 parses `..` as a URL host, so the relative
> `file:` (single slash) form is used instead.

---

## Tests

```powershell
.\.venv\Scripts\python -m pytest tests -q
```

No live LLM or network calls: the graph tests use a `CannedLLM` (fake
`LLMProvider` returning pre-arranged tool-call JSON then `DONE`) and a fake
`execution` stub that records `event()` / `finish()` calls.

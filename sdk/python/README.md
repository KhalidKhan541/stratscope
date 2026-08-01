# StratScope Python SDK

Official Python client for the [StratScope](https://github.com/KhalidKhan541/stratscope)
Execution Intelligence Platform.

StratScope turns every AI execution into immutable, observable, replayable
organizational intelligence. This SDK records your agent executions — start,
in-flight events, and completion telemetry — to the StratScope ingest API so
every execution can be measured, searched, and improved.

## Features

- Track execution start, in-flight events, and completion telemetry
- Zero runtime dependencies (Python standard library only)
- Never crashes your app: telemetry failures are retried once (0.5s backoff)
  and dropped with a warning log
- Events are buffered and flushed in batches of 20 (chunked at 500 per request)
- Reports `sdk_version` with every execution

## Requirements

Python 3.9+.

## Install

```bash
pip install stratscope
```

## Get an API key

You need a StratScope API key to send telemetry. Email
khalidkhan46572@gmail.com to get one.

## Environment variables

| Variable               | Default                                                    | Description                          |
| ---------------------- | ---------------------------------------------------------- | ------------------------------------ |
| `STRATSCOPE_API_KEY`   | —                                                          | Your StratScope API key (required)   |
| `STRATSCOPE_BASE_URL`  | `https://stratscope-api.khalidkhan.workers.dev`            | StratScope ingest API base URL       |
| `STRATSCOPE_PROJECT_ID`| —                                                          | Project the execution belongs to     |
| `STRATSCOPE_AGENT_ID`  | —                                                          | Agent that ran the execution         |

Every value can also be passed explicitly to `stratscope.start()`, which takes
precedence over the environment.

## Quickstart

```python
import stratscope

execution = stratscope.start(
    api_key="sk-...",        # or set STRATSCOPE_API_KEY
    project_id="proj_123",   # or set STRATSCOPE_PROJECT_ID
    agent_id="agent_456",    # or set STRATSCOPE_AGENT_ID
    model="llama-3.3-70b-versatile",
    provider="groq",
)

execution.event("step_started", {"step": "extract"})
execution.event("step_completed", {"step": "extract", "rows": 42})

execution.finish(
    status="completed",
    latency_ms=1200,
    cost_usd=0.0032,
    tokens_in=1200,
    tokens_out=900,
)
```

With the environment variables above set, the same session is just:

```python
import stratscope

execution = stratscope.start()
# ... same event() / finish() calls
```

## API reference

### `stratscope.start(api_key=None, base_url=None, project_id=None, agent_id=None, model=None, provider=None, trace_id=None, metadata=None)`

Creates an execution on the StratScope platform and returns a
`StratScopeExecution`.

- `api_key` (str, optional) — API key; falls back to `STRATSCOPE_API_KEY`.
- `base_url` (str, optional) — ingest API base URL; falls back to
  `STRATSCOPE_BASE_URL`, then the default hosted endpoint.
- `project_id` (str, optional) — falls back to `STRATSCOPE_PROJECT_ID`.
  Required (either way).
- `agent_id` (str, optional) — falls back to `STRATSCOPE_AGENT_ID`.
  Required (either way).
- `model` (str, optional) — model identifier used for the execution.
- `provider` (str, optional) — model provider (e.g. `groq`, `openai`).
- `trace_id` (str, optional) — client-side trace id; the server-issued trace
  id wins when the response provides one.
- `metadata` (dict, optional) — arbitrary metadata attached to the execution.

Raises `ValueError` when `project_id`/`agent_id` are missing, and
`stratscope.StratScopeError` when the API rejects the request (for example, an
invalid API key). Network failures after one retry return a local
`StratScopeExecution` that safely no-ops, with a warning log.

### `StratScopeExecution.event(event_type, payload, metadata=None)`

Records an in-flight event. Events are buffered and flushed automatically in
batches of 20, or on `finish()`.

- `event_type` (str) — event name, e.g. `"step_started"`.
- `payload` (dict) — event data.
- `metadata` (dict, optional) — arbitrary event metadata.

### `StratScopeExecution.finish(status, *, latency_ms=None, cost_usd=None, tokens_in=None, tokens_out=None, error=None)`

Flushes buffered events and patches the execution with completion telemetry.

- `status` (str) — `"completed"` or `"failed"`.
- `latency_ms` (int, optional) — execution latency in milliseconds.
- `cost_usd` (float, optional) — execution cost in USD.
- `tokens_in` / `tokens_out` (int, optional) — token usage.
- `error` (str, optional) — error message when the execution failed.

### `stratscope.StratScopeError`

Raised when the StratScope API rejects a request (HTTP 4xx/5xx).

## Development

```bash
python -m pytest tests -q
```

## License

MIT — see [LICENSE](LICENSE).

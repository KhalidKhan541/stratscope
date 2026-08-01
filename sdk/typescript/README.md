# @stratscope/sdk

StratScope agent execution telemetry SDK — trace, batch, retry.

Official TypeScript client for the StratScope Execution Intelligence Platform. Mirrors the [Python SDK](../python/).

## Install

```bash
npm install @stratscope/sdk
```

No runtime dependencies — uses the global `fetch` (Node 18+, edge runtimes).

## Quickstart

```typescript
import { StratScopeClient } from "@stratscope/sdk";

const client = new StratScopeClient({
  apiKey: process.env.STRATSCOPE_API_KEY ?? "",
  projectId: "proj_123",
  agentId: "agent_456",
  model: "llama-3.3-70b-versatile",
  provider: "groq",
});

const execution = await client.startExecution();

execution.event({ eventType: "step.started", payload: { step: "extract" } });
execution.event({ eventType: "step.completed", payload: { step: "extract", rows: 42 } });

await execution.finish({
  status: "completed",
  latencyMs: 1200,
  costUsd: 0.0032,
  tokensIn: 1200,
  tokensOut: 900,
});
```

## Environment variables

The SDK takes explicit constructor options and does not read the environment itself. Recommended wiring:

| Variable | Description | Example |
| --- | --- | --- |
| `STRATSCOPE_API_KEY` | API key for the StratScope API | `sk-...` |
| `STRATSCOPE_BASE_URL` | API base URL (defaults to `https://stratscope-api.khalidkhan.workers.dev`) | `https://your-gateway.example.com` |
| `STRATSCOPE_PROJECT_ID` | Project identifier | `proj_123` |
| `STRATSCOPE_AGENT_ID` | Agent identifier | `agent_456` |
| `STRATSCOPE_MODEL` | Default model reported on new executions | `llama-3.3-70b-versatile` |
| `STRATSCOPE_PROVIDER` | Default provider reported on new executions | `groq` |

## API reference

### `new StratScopeClient(options)`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `apiKey` | `string` | (required) | API key for the StratScope API |
| `baseUrl` | `string` | `https://stratscope-api.khalidkhan.workers.dev` | API base URL (trailing slash trimmed) |
| `projectId` | `string` | (required) | Project identifier |
| `agentId` | `string` | (required) | Agent identifier |
| `model` | `string` | — | Default model for new executions |
| `provider` | `string` | — | Default provider for new executions |
| `sdkVersion` | `string` | `0.1.0` | SDK version reported to the API (`X-StratScope-SDK: typescript-<version>`) |

### `startExecution(options?)`

`options`: `{ model?, provider?, traceId?, metadata? }` — per-execution overrides.

Returns `Promise<Execution>`. Throws `StratScopeError` on non-2xx responses (with the server error message). Network errors are retried once; 4xx responses are not retried.

### `Execution`

```typescript
interface Execution {
  id: string;
  traceId: string;
  event(input: EventInput): void;
  finish(input: FinishInput): Promise<void>;
}
```

#### `execution.event(input)`

`input`: `{ eventType, payload, metadata? }` where `payload` is `Record<string, unknown>`.

Buffered and flushed in batches of 20 (max 500 per batch). Fire-and-forget — never throws. On network/server failure the batch is retried once (0.5s backoff), then dropped with a `console.warn`.

#### `execution.finish(input)`

`input`: `{ status: "completed" | "failed", latencyMs?, costUsd?, tokensIn?, tokensOut?, error? }`.

Flushes buffered events, then `PATCH`es the execution with the final stats. Retried once on failure; never throws.

### `StratScopeError`

```typescript
class StratScopeError extends Error {
  status: number;
}
```

### Transport

- `POST /v1/ingest/executions` — start an execution
- `POST /v1/ingest/events` — flush event batches (`{ batch: [...] }`)
- `PATCH /v1/ingest/executions/:id` — finish an execution

Headers: `Authorization: Bearer <key>`, `Content-Type: application/json`, `X-StratScope-SDK: typescript-0.1.0`. Requests time out after 10s.

## License

MIT

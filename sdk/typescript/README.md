# @stratscope/sdk

StratScope TypeScript SDK — Capture AI execution intelligence.

## Installation

```bash
npm install @stratscope/sdk
```

## Usage

```typescript
import { StratScopeClient } from "@stratscope/sdk";

const client = new StratScopeClient({
  apiKey: "your-api-key",
  projectId: "your-project-id",
  organizationId: "your-org-id",
});

// Start an execution
const execution = await client.startExecution({
  model: "gpt-4",
  provider: "openai",
});

// Record events
execution.recordModelCall({
  model: "gpt-4",
  provider: "openai",
  inputTokens: 100,
  outputTokens: 50,
  latencyMs: 200,
});

// Complete execution
await execution.complete();
```

## Development

```bash
npm install
npm run build
npm test
```
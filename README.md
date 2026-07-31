# StratScope

AI Execution Intelligence Platform — The Operating System for Production AI.

## What is StratScope?

StratScope captures every AI execution and transforms it into organizational intelligence. Every execution generates events, events create artifacts, artifacts generate knowledge, knowledge becomes learning, learning creates optimization, optimization generates recommendations.

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start development

```bash
pnpm dev
```

### 3. Run database migrations

```bash
./scripts/db-migrate.sh development
```

## Architecture

```
packages/core       — Domain types, IDs, errors, Result type
packages/events     — Event bus, event store, event types
apps/api           — Cloudflare Workers API (Hono)
apps/dashboard     — Next.js dashboard
sdk/typescript     — TypeScript SDK
sdk/python         — Python SDK
```

## Tech Stack

- **Backend**: Cloudflare Workers, Hono, TypeScript
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2
- **Cache**: Cloudflare KV
- **Queues**: Cloudflare Queues
- **Auth**: Clerk
- **AI**: Groq (provider abstraction)
- **Frontend**: Next.js, React, Tailwind CSS
- **Monorepo**: pnpm workspaces, TurboRepo

## Documentation

- [Volume 1 — Vision, Mission & Company](docs/Volume%201%20—%20Vision,%20Mission%20&%20Company.md)
- [Volume 2 — The Manifesto](docs/Volume%202.md)
- [Volume 3 — PRD](docs/Volume%203.md)
- [Volume 4 — Technical Architecture](docs/Volume%204.md)
- [Volume 5 — Data Architecture](docs/Volume%205.md)
- [Volume 6 — EIOS](docs/Volume%206.md)
- [Volume 7 — Constitutional Specifications](docs/Constitutional%20Specifications-Volume7.md)
- [Volume 8 — Execution Intelligence Protocol](docs/Execution%20Intelligence%20Protocol-Volume8.md)

## License

Proprietary — StratScope, Inc.

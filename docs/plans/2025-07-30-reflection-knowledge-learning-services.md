# Implementation Plan: Reflection, Knowledge & Learning Services

## Context

The StratScope EIOS pipeline requires three intelligence services to complete the post-evaluation stages of the execution lifecycle. The database migrations already exist (0009–0012), the core IDs and Result/AppError patterns are established, and the EventBus/EventStore interfaces are defined. We need to create the domain types, repositories, services, and supporting interfaces.

## Scope

### In Scope
- Domain types for Reflection, KnowledgeNode, KnowledgeEdge, LearningRecord, plus SearchOptions and GraphQueryRequest/Result
- LLM Provider interface (abstract, not coupled to Groq)
- 3 repositories (Reflection, Knowledge, Learning) backed by D1
- 3 services (Reflection, Knowledge, Learning)
- All files in `apps/api/src/`

### Out of Scope
- Actual Groq adapter implementation (only the interface)
- API routes (separate task)
- Tests (separate task per CLAUDE.md Phase 2–3)

---

## File Plan

### 1. Domain Types — `packages/core/src/domain/`

These types don't exist yet (the domain directories are empty). Create them so services can import from `@stratscope/core`.

| File | Contents |
|------|----------|
| `reflection/Reflection.ts` | `Reflection` interface, `ReflectionInput` type |
| `knowledge/KnowledgeNode.ts` | `KnowledgeNode`, `KnowledgeNodeType` union, `KnowledgeEdge`, `KnowledgeEdgeType` union |
| `knowledge/SearchOptions.ts` | `SearchOptions` interface |
| `knowledge/GraphQuery.ts` | `GraphQueryRequest`, `GraphQueryResult`, `GraphTraversalStep` |
| `learning/LearningRecord.ts` | `LearningRecord`, `PatternType` union, `Severity` union |
| `evaluation/Evaluation.ts` | `Evaluation` interface (needed by ReflectionService) |
| `execution/Execution.ts` | `Execution` interface (needed by all services) |

**Barrel exports** — update `packages/core/src/shared/index.ts` (or create a new `packages/core/src/domain/index.ts`) to export all new types.

### 2. LLM Provider Interface — `apps/api/src/services/LLMProvider.ts`

```typescript
interface LLMProvider {
  generateStructured<T>(params: {
    model: string;
    systemPrompt: string;
    userPrompt: string;
    schema: ZodSchema<T>;
  }): Promise<Result<T, AppError>>;
}
```

Abstracts away Groq. Follows the AI Provider Rule from CLAUDE.md.

### 3. Repositories — `apps/api/src/repositories/`

All repositories follow the same pattern:
- Constructor receives `D1Database` binding
- All queries are parameterized (no string interpolation)
- Cursor-based pagination using `rowid` or `created_at` + `id` composite cursor
- Return `Result<T, AppError>` — never throw
- Structured logging via injected `Logger`

| File | Table | Key Methods |
|------|-------|-------------|
| `ReflectionRepository.ts` | `reflections` | `insert`, `findById`, `findByExecutionId`, `findByProjectId` (paginated) |
| `KnowledgeRepository.ts` | `knowledge_nodes` + `knowledge_edges` | `insertNode`, `insertEdge`, `findById`, `findByOrganizationId` (paginated), `searchByText`, `findEdgesBySource`, `findEdgesByTarget`, `findEdgesByType` |
| `LearningRepository.ts` | `learning_records` | `insert`, `findById`, `findByProjectId` (paginated), `findByProjectIdAndType`, `findRepeatingFailures` |

**Cursor pagination**: encode `${created_at}:${id}` as base64 cursor. Decode to get `(cursorCreatedAt, cursorId)` for `WHERE (created_at, id) > (?, ?)` compound comparison.

### 4. Services — `apps/api/src/services/`

#### `ReflectionService.ts`

**Constructor deps**: `ReflectionRepository`, `ExecutionRepository` (read-only), `EvaluationRepository` (read-only), `LLMProvider`, `EventBus`, `Logger`

**`generateReflection(executionId)`** flow:
1. Fetch execution by ID → validate exists and status is `evaluated` or later
2. Fetch evaluation by execution ID → validate exists
3. Build system prompt defining reflection structure (summary, strengths, weaknesses, recommendations, confidence, reasoning)
4. Build user prompt with execution + evaluation data
5. Call `LLMProvider.generateStructured()` with Zod schema for reflection output
6. Persist reflection via repository
7. Publish `reflection.generated` event via EventBus
8. Return reflection

**`getReflection(id)`**: Simple lookup, return NotFoundError if missing.

**`listByExecution(executionId)`**: Delegate to repository.

**`listByProject(projectId, options)`**: Delegate to repository with cursor pagination.

#### `KnowledgeService.ts`

**Constructor deps**: `KnowledgeRepository`, `ReflectionRepository`, `ExecutionRepository`, `EventBus`, `Logger`

**`extractKnowledge(executionId)`** flow:
1. Fetch execution → validate exists
2. Fetch reflections for this execution
3. For each reflection, extract knowledge nodes:
   - Create execution node (type: `execution`)
   - If agent_id present, create/upsert agent node (type: `agent`)
   - Create pattern nodes from strengths (type: `success`) and weaknesses (type: `failure`)
   - Create prompt node if prompt metadata exists (type: `prompt`)
4. Create edges between nodes (USED, GENERATED, FAILED, etc.)
5. Persist all nodes and edges
6. Publish `knowledge.extracted` event
7. Return created nodes

**`getNode(id)`**: Simple lookup.

**`listByOrganization(organizationId, options)`**: Paginated list with cursor.

**`search(organizationId, query, options)`**: Full-text search on `name` and `description` fields using D1 `LIKE` or `MATCH`. Return ranked results.

**`query(request)`**: Graph traversal. Given a starting node, follow edges of specified types up to N hops. Return nodes + edges.

**`createEdge(sourceId, targetId, edgeType, properties?)`**: Validate both nodes exist, create edge, persist.

#### `LearningService.ts`

**Constructor deps**: `LearningRepository`, `ExecutionRepository`, `ReflectionRepository`, `KnowledgeRepository`, `EventBus`, `Logger`

**`detectPatterns(projectId)`** flow:
1. Fetch recent executions for project (last N executions or time window)
2. Run pattern detection algorithms:
   - **repeated_failure**: Group failures by error signature, find recurring patterns (frequency >= 2)
   - **success_pattern**: Find successful execution sequences with similar steps
   - **prompt_regression**: Compare evaluation scores over time for same prompt templates
   - **model_routing**: Analyze which models perform best for which task types
   - **tool_effectiveness**: Rank tools by success rate and latency
   - **cost_optimization**: Find executions where cheaper models could achieve similar quality
3. For each detected pattern, create `LearningRecord` with evidence array
4. Persist records
5. Publish `learning.generated` event
6. Return learning records

**`getPatternsByProject(projectId, options)`**: Paginated list.

**`getPatternById(id)`**: Simple lookup.

**`getPatternsByType(projectId, patternType)`**: Filter by pattern type.

---

## Implementation Order

1. **Domain types** (core package) — all 7 files + barrel export
2. **LLMProvider interface** — `apps/api/src/services/LLMProvider.ts`
3. **ReflectionRepository** — `apps/api/src/repositories/ReflectionRepository.ts`
4. **ReflectionService** — `apps/api/src/services/ReflectionService.ts`
5. **KnowledgeRepository** — `apps/api/src/repositories/KnowledgeRepository.ts`
6. **KnowledgeService** — `apps/api/src/services/KnowledgeService.ts`
7. **LearningRepository** — `apps/api/src/repositories/LearningRepository.ts`
8. **LearningService** — `apps/api/src/services/LearningService.ts`

Each step is independently testable. Repositories can be tested against D1. Services can be tested with mocked repositories.

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Cursor = `created_at:id` composite | D1 doesn't support `OFFSET` well; compound cursor gives stable ordering |
| JSON fields stored as TEXT in D1 | D1 (SQLite) doesn't have native JSON type; serialize/deserialize in repository |
| LLMProvider as abstract interface | Follows AI Provider Rule from CLAUDE.md — never couple to Groq |
| Knowledge extraction is synchronous per execution | Simpler; async queue can be added later if needed |
| Pattern detection runs on-demand | Not scheduled; called explicitly by pipeline orchestrator |
| Graph traversal limited to N hops | Prevents infinite loops; default max 3 hops |

---

## Verification

1. **TypeScript**: Run `pnpm typecheck` from repo root
2. **Unit tests**: Each service should have unit tests with mocked dependencies
3. **Integration tests**: Repositories against D1 (use wrangler miniflare)
4. **Manual verification**: POST to `/v1/reflections`, `/v1/knowledge`, check events published

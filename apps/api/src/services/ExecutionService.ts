/**
 * Execution Service — the ingestion layer for the StratScope platform.
 *
 * Responsible for creating, retrieving, updating, and managing execution records.
 * Every AI interaction flows through this service to become an immutable
 * organizational intelligence record.
 *
 * This service enforces the Execution Specification (EXS) and ensures
 * all invariants are maintained before persisting to the event store.
 */

import { z } from "zod";
import type {
  ExecutionId,
  OrganizationId,
  ProjectId,
  AgentId,
} from "@stratscope/core";
import type { Result } from "@stratscope/core";
import { ok, err } from "@stratscope/core";
import type { AppError } from "@stratscope/core";
import { validationError, notFoundError, conflictError, internalError } from "@stratscope/core";
import type { Logger } from "@stratscope/core";
import type { Execution } from "@stratscope/core/src/domain/execution/Execution";
import { createExecution } from "@stratscope/core/src/domain/execution/Execution";
import type { EventStore, DomainEvent } from "@stratscope/events";
import { createEventId, CURRENT_SCHEMA_VERSION } from "@stratscope/events";
import type { IExecutionRepository, ListExecutionsQuery, PaginatedResult, TimeRange, ExecutionStats } from "../repositories/ExecutionRepository";

/**
 * Payload for creating a new execution.
 */
export interface CreateExecutionPayload {
  readonly organization_id: string;
  readonly project_id: string;
  readonly agent_id?: string;
  readonly model: string;
  readonly provider: string;
  readonly trace_id?: string;
  readonly parent_execution_id?: string;
  readonly sdk_version: string;
  readonly pipeline_version: string;
  readonly input?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Payload for updating an existing execution.
 */
export interface UpdateExecutionPayload {
  readonly status?: string;
  readonly started_at?: string;
  readonly completed_at?: string;
  readonly latency_ms?: number;
  readonly queue_latency_ms?: number;
  readonly processing_latency_ms?: number;
  readonly input_tokens?: number;
  readonly output_tokens?: number;
  readonly total_tokens?: number;
  readonly estimated_cost?: number;
  readonly metadata?: Record<string, unknown>;
  readonly error?: Record<string, unknown>;
}

/**
 * Options for replaying an execution.
 */
export interface ReplayOptions {
  readonly preserve_trace_id?: boolean;
  readonly input_overrides?: Record<string, unknown>;
  readonly metadata_overrides?: Record<string, unknown>;
}

/**
 * Completed execution with timing and token information.
 */
export interface CompletedExecution extends Execution {
  readonly completed_at: string;
  readonly latency_ms: number;
}

/**
 * Query parameters for listing executions.
 */
export interface ListExecutionsQueryParams {
  readonly organization_id: string;
  readonly project_id?: string;
  readonly status?: string;
  readonly agent_id?: string;
  readonly cursor?: string;
  readonly limit?: number;
  readonly direction?: "forward" | "backward";
}

/**
 * Service interface for execution operations.
 */
export interface IExecutionService {
  createExecution(payload: CreateExecutionPayload): Promise<Result<Execution>>;
  getExecution(id: ExecutionId, organizationId: OrganizationId): Promise<Result<Execution>>;
  listExecutions(query: ListExecutionsQueryParams): Promise<Result<PaginatedResult<Execution>>>;
  updateExecution(id: ExecutionId, update: UpdateExecutionPayload): Promise<Result<Execution>>;
  completeExecution(id: ExecutionId): Promise<Result<CompletedExecution>>;
  replayExecution(id: ExecutionId, options: ReplayOptions): Promise<Result<Execution>>;
  archiveExecution(id: ExecutionId): Promise<Result<void>>;
}

/** Zod schema for CreateExecutionPayload validation. */
const CreateExecutionPayloadSchema = z.object({
  organization_id: z.string().min(1),
  project_id: z.string().min(1),
  agent_id: z.string().optional(),
  model: z.string().min(1),
  provider: z.string().min(1),
  trace_id: z.string().optional(),
  parent_execution_id: z.string().optional(),
  sdk_version: z.string().min(1),
  pipeline_version: z.string().min(1),
  input: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/** Zod schema for UpdateExecutionPayload validation. */
const UpdateExecutionPayloadSchema = z.object({
  status: z.string().optional(),
  started_at: z.string().optional(),
  completed_at: z.string().optional(),
  latency_ms: z.number().nonnegative().optional(),
  queue_latency_ms: z.number().nonnegative().optional(),
  processing_latency_ms: z.number().nonnegative().optional(),
  input_tokens: z.number().nonnegative().optional(),
  output_tokens: z.number().nonnegative().optional(),
  total_tokens: z.number().nonnegative().optional(),
  estimated_cost: z.number().nonnegative().optional(),
  metadata: z.record(z.unknown()).optional(),
  error: z.record(z.unknown()).optional(),
});

const VALID_EXECUTION_STATUSES = new Set([
  "created",
  "accepted",
  "normalized",
  "evaluated",
  "reflected",
  "knowledge_extracted",
  "learned",
  "optimized",
  "recommendation_published",
  "archived",
  "failed",
  "cancelled",
]);

/**
 * Execution Service implementation.
 *
 * Orchestrates execution lifecycle operations, coordinating between
 * the repository layer and the event store.
 */
export class ExecutionService implements IExecutionService {
  private readonly repository: IExecutionRepository;
  private readonly eventStore: EventStore;
  private readonly logger: Logger;

  constructor(
    repository: IExecutionRepository,
    eventStore: EventStore,
    logger: Logger
  ) {
    this.repository = repository;
    this.eventStore = eventStore;
    this.logger = logger;
  }

  async createExecution(payload: CreateExecutionPayload): Promise<Result<Execution>> {
    const validation = CreateExecutionPayloadSchema.safeParse(payload);
    if (!validation.success) {
      const fieldErrors = validation.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return err(validationError(
        `Invalid execution payload: ${validation.error.issues.map((i) => i.message).join(", ")}`,
        fieldErrors,
      ));
    }

    const data = validation.data;
    const executionId = crypto.randomUUID() as ExecutionId;
    const traceId = data.trace_id ?? crypto.randomUUID();

    const execution = createExecution({
      execution_id: executionId,
      organization_id: data.organization_id as OrganizationId,
      project_id: data.project_id as ProjectId,
      model: data.model,
      provider: data.provider,
      trace_id: traceId,
      pipeline_version: data.pipeline_version,
      sdk_version: data.sdk_version,
      agent_id: data.agent_id ? (data.agent_id as AgentId) : undefined,
      parent_execution_id: data.parent_execution_id
        ? (data.parent_execution_id as ExecutionId)
        : undefined,
      metadata: data.metadata,
    });

    try {
      await this.repository.create(execution);

      const event: DomainEvent = {
        event_id: createEventId(),
        event_type: "execution.created",
        execution_id: executionId,
        organization_id: data.organization_id as OrganizationId,
        project_id: data.project_id as ProjectId,
        timestamp: new Date().toISOString(),
        schema_version: CURRENT_SCHEMA_VERSION,
        producer: "execution-service",
        payload: {
          execution_id: executionId,
          model: data.model,
          provider: data.provider,
          trace_id: traceId,
        },
        metadata: data.metadata ?? {},
      };

      await this.eventStore.append(event);

      this.logger.info("Execution created", {
        executionId,
        organizationId: data.organization_id,
        projectId: data.project_id,
        model: data.model,
        provider: data.provider,
      });

      return ok(execution);
    } catch (error) {
      this.logger.error("Failed to create execution", error instanceof Error ? error : undefined, {
        organizationId: data.organization_id,
        projectId: data.project_id,
      });
      return err(internalError(
        "Failed to create execution",
        error instanceof Error ? { cause: error.message } : undefined,
      ));
    }
  }

  async getExecution(id: ExecutionId, organizationId: OrganizationId): Promise<Result<Execution>> {
    try {
      const execution = await this.repository.findById(id, organizationId);
      if (!execution) {
        return err(notFoundError("Execution", id));
      }
      return ok(execution);
    } catch (error) {
      this.logger.error("Failed to get execution", error instanceof Error ? error : undefined, {
        executionId: id,
        organizationId,
      });
      return err(internalError(
        "Failed to retrieve execution",
        error instanceof Error ? { cause: error.message } : undefined,
      ));
    }
  }

  async listExecutions(query: ListExecutionsQueryParams): Promise<Result<PaginatedResult<Execution>>> {
    const orgId = query.organization_id as OrganizationId;
    const repoQuery: ListExecutionsQuery = {
      organization_id: orgId,
      project_id: query.project_id ? (query.project_id as ProjectId) : undefined,
      status: query.status,
      agent_id: query.agent_id,
      cursor: query.cursor,
      limit: query.limit ?? 20,
      direction: query.direction,
    };

    try {
      const result = await this.repository.list(repoQuery);
      return ok(result);
    } catch (error) {
      this.logger.error("Failed to list executions", error instanceof Error ? error : undefined, {
        organizationId: orgId,
      });
      return err(internalError(
        "Failed to list executions",
        error instanceof Error ? { cause: error.message } : undefined,
      ));
    }
  }

  async updateExecution(id: ExecutionId, update: UpdateExecutionPayload): Promise<Result<Execution>> {
    const validation = UpdateExecutionPayloadSchema.safeParse(update);
    if (!validation.success) {
      return err(validationError(
        `Invalid update payload: ${validation.error.issues.map((i) => i.message).join(", ")}`,
      ));
    }

    const data = validation.data;

    if (data.status && !VALID_EXECUTION_STATUSES.has(data.status)) {
      return err(validationError(`Invalid status: ${data.status}`, [{ field: "status", message: `Invalid status: ${data.status}` }]));
    }

    try {
      const existing = await this.repository.findByIdempotent(id);
      if (!existing) {
        return err(notFoundError("Execution", id));
      }

      const updateFields: Record<string, unknown> = {};
      if (data.status !== undefined) updateFields.status = data.status;
      if (data.started_at !== undefined) updateFields.started_at = data.started_at;
      if (data.completed_at !== undefined) updateFields.completed_at = data.completed_at;
      if (data.latency_ms !== undefined) updateFields.latency_ms = data.latency_ms;
      if (data.queue_latency_ms !== undefined) updateFields.queue_latency_ms = data.queue_latency_ms;
      if (data.processing_latency_ms !== undefined) updateFields.processing_latency_ms = data.processing_latency_ms;
      if (data.input_tokens !== undefined) updateFields.input_tokens = data.input_tokens;
      if (data.output_tokens !== undefined) updateFields.output_tokens = data.output_tokens;
      if (data.total_tokens !== undefined) updateFields.total_tokens = data.total_tokens;
      if (data.estimated_cost !== undefined) updateFields.estimated_cost = data.estimated_cost;
      if (data.metadata !== undefined) updateFields.metadata = data.metadata;
      if (data.error !== undefined) updateFields.error = data.error;

      await this.repository.update(id, updateFields as Partial<Execution>);

      const updated = await this.repository.findByIdempotent(id);
      if (!updated) {
        return err(internalError("Execution not found after update"));
      }

      this.logger.info("Execution updated", {
        executionId: id,
        updatedFields: Object.keys(updateFields),
      });

      return ok(updated);
    } catch (error) {
      this.logger.error("Failed to update execution", error instanceof Error ? error : undefined, {
        executionId: id,
      });
      return err(internalError(
        "Failed to update execution",
        error instanceof Error ? { cause: error.message } : undefined,
      ));
    }
  }

  async completeExecution(id: ExecutionId): Promise<Result<CompletedExecution>> {
    try {
      const existing = await this.repository.findByIdempotent(id);
      if (!existing) {
        return err(notFoundError("Execution", id));
      }

      if (existing.status === "archived" || existing.status === "failed" || existing.status === "cancelled") {
        return err(conflictError(
          "Execution",
          `Cannot complete execution in terminal status '${existing.status}'`,
        ));
      }

      const now = new Date().toISOString();
      const startedAt = existing.started_at ?? existing.created_at;
      const latencyMs = new Date(now).getTime() - new Date(startedAt).getTime();

      await this.repository.update(id, {
        status: "completed",
        completed_at: now,
        latency_ms: latencyMs,
      } as Partial<Execution>);

      const completed = await this.repository.findByIdempotent(id);
      if (!completed) {
        return err(internalError("Execution not found after completion"));
      }

      const event: DomainEvent = {
        event_id: createEventId(),
        event_type: "execution.completed",
        execution_id: id,
        organization_id: existing.organization_id,
        project_id: existing.project_id,
        timestamp: now,
        schema_version: CURRENT_SCHEMA_VERSION,
        producer: "execution-service",
        payload: {
          execution_id: id,
          latency_ms: latencyMs,
          total_tokens: existing.total_tokens,
          estimated_cost: existing.estimated_cost,
        },
        metadata: {},
      };

      await this.eventStore.append(event);

      this.logger.info("Execution completed", {
        executionId: id,
        latencyMs,
      });

      return ok(completed as CompletedExecution);
    } catch (error) {
      this.logger.error("Failed to complete execution", error instanceof Error ? error : undefined, {
        executionId: id,
      });
      return err(internalError(
        "Failed to complete execution",
        error instanceof Error ? { cause: error.message } : undefined,
      ));
    }
  }

  async replayExecution(id: ExecutionId, options: ReplayOptions): Promise<Result<Execution>> {
    try {
      const existing = await this.repository.findByIdempotent(id);
      if (!existing) {
        return err(notFoundError("Execution", id));
      }

      const newExecutionId = crypto.randomUUID() as ExecutionId;
      const traceId = options.preserve_trace_id
        ? existing.trace_id
        : crypto.randomUUID();

      const metadata = {
        ...existing.metadata,
        ...options.metadata_overrides,
        replayed_from: id,
        replayed_at: new Date().toISOString(),
      };

      const replayed = createExecution({
        execution_id: newExecutionId,
        organization_id: existing.organization_id,
        project_id: existing.project_id,
        model: existing.model,
        provider: existing.provider,
        trace_id: traceId,
        pipeline_version: existing.pipeline_version,
        sdk_version: existing.sdk_version,
        agent_id: existing.agent_id,
        parent_execution_id: id,
        metadata,
      });

      await this.repository.create(replayed);

      this.logger.info("Execution replayed", {
        originalExecutionId: id,
        replayedExecutionId: newExecutionId,
      });

      return ok(replayed);
    } catch (error) {
      this.logger.error("Failed to replay execution", error instanceof Error ? error : undefined, {
        executionId: id,
      });
      return err(internalError(
        "Failed to replay execution",
        error instanceof Error ? { cause: error.message } : undefined,
      ));
    }
  }

  async archiveExecution(id: ExecutionId): Promise<Result<void>> {
    try {
      const existing = await this.repository.findByIdempotent(id);
      if (!existing) {
        return err(notFoundError("Execution", id));
      }

      if (existing.status === "archived") {
        return err(conflictError("Execution", "Execution is already archived"));
      }

      await this.repository.update(id, {
        status: "archived",
      } as Partial<Execution>);

      const event: DomainEvent = {
        event_id: createEventId(),
        event_type: "execution.archived",
        execution_id: id,
        organization_id: existing.organization_id,
        project_id: existing.project_id,
        timestamp: new Date().toISOString(),
        schema_version: CURRENT_SCHEMA_VERSION,
        producer: "execution-service",
        payload: {
          execution_id: id,
          previous_status: existing.status,
        },
        metadata: {},
      };

      await this.eventStore.append(event);

      this.logger.info("Execution archived", {
        executionId: id,
      });

      return ok(undefined);
    } catch (error) {
      this.logger.error("Failed to archive execution", error instanceof Error ? error : undefined, {
        executionId: id,
      });
      return err(internalError(
        "Failed to archive execution",
        error instanceof Error ? { cause: error.message } : undefined,
      ));
    }
  }
}

import type { ExecutionHandle, SpanHandle, ModelCallParams, ToolCallParams, MemoryOperationParams, EventParams, CompleteExecutionParams, FailExecutionParams, StratScopeConfig } from "./types";
import type { EventBuffer } from "./buffer";
import type { StratScopeClient } from "./client";

interface ExecutionHandleParams {
  readonly executionId: string;
  readonly traceId: string;
  readonly config: StratScopeConfig;
  readonly buffer: EventBuffer;
  readonly client: StratScopeClient;
}

export class ExecutionHandleImpl implements ExecutionHandle {
  readonly executionId: string;
  readonly traceId: string;
  private readonly config: StratScopeConfig;
  private readonly buffer: EventBuffer;
  private readonly client: StratScopeClient;
  private startTime: number;
  private eventCount: number = 0;

  constructor(params: ExecutionHandleParams) {
    this.executionId = params.executionId;
    this.traceId = params.traceId;
    this.config = params.config;
    this.buffer = params.buffer;
    this.client = params.client;
    this.startTime = Date.now();
  }

  recordModelCall(params: ModelCallParams): void {
    this.buffer.push(this.createEvent("model.called", {
      model: params.model,
      provider: params.provider,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      latency_ms: params.latencyMs,
      cost: params.cost,
      input: params.input,
      output: params.output,
      ...params.metadata,
    }));
    this.eventCount++;
  }

  recordToolCall(params: ToolCallParams): void {
    this.buffer.push(this.createEvent("tool.called", {
      tool_name: params.toolName,
      tool_type: params.toolType,
      input: params.input,
      output: params.output,
      latency_ms: params.latencyMs,
      success: params.success,
      error: params.error,
    }));
    this.eventCount++;
  }

  recordMemoryRead(params: MemoryOperationParams): void {
    this.buffer.push(this.createEvent("memory.read", {
      memory_type: params.memoryType,
      query: params.query,
      results: params.results,
      latency_ms: params.latencyMs,
    }));
    this.eventCount++;
  }

  recordMemoryWrite(params: MemoryOperationParams): void {
    this.buffer.push(this.createEvent("memory.written", {
      memory_type: params.memoryType,
      query: params.query,
      results: params.results,
      latency_ms: params.latencyMs,
    }));
    this.eventCount++;
  }

  recordEvent(params: EventParams): void {
    this.buffer.push(this.createEvent(params.eventType, params.payload, params.metadata));
    this.eventCount++;
  }

  async complete(params: CompleteExecutionParams = {}): Promise<void> {
    this.buffer.push(this.createEvent("execution.completed", {
      status: params.status ?? "completed",
      output: params.output,
      latency_ms: params.latencyMs ?? (Date.now() - this.startTime),
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      estimated_cost: params.estimatedCost,
      event_count: this.eventCount,
      ...params.metadata,
    }));

    await this.client.flush();
  }

  async fail(params: FailExecutionParams): Promise<void> {
    this.buffer.push(this.createEvent("execution.failed", {
      error: params.error,
      error_code: params.errorCode,
      latency_ms: Date.now() - this.startTime,
      ...params.metadata,
    }));

    await this.client.flush();
  }

  startSpan(name: string): SpanHandle {
    const spanId = crypto.randomUUID();
    const spanStart = Date.now();

    return {
      spanId,
      end: () => {
        this.buffer.push(this.createEvent("span.ended", {
          span_name: name,
          span_id: spanId,
          duration_ms: Date.now() - spanStart,
        }));
      },
      setAttribute: (key: string, value: unknown) => {
        this.buffer.push(this.createEvent("span.attribute", {
          span_id: spanId,
          span_name: name,
          key,
          value,
        }));
      },
    };
  }

  private createEvent(eventType: string, payload: Record<string, unknown>, metadata?: Record<string, unknown>) {
    return {
      event_id: crypto.randomUUID(),
      event_type: eventType,
      execution_id: this.executionId,
      organization_id: this.config.organizationId,
      project_id: this.config.projectId,
      timestamp: new Date().toISOString(),
      schema_version: "1.0.0",
      producer: `stratscope-sdk-ts/${this.config.sdkVersion}`,
      payload,
      metadata: metadata ?? {},
    };
  }
}
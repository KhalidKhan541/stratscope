export interface StratScopeConfig {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly projectId: string;
  readonly organizationId: string;
  readonly environment?: string;
  readonly sdkVersion?: string;
  readonly pipelineVersion?: string;
  readonly enableOfflineBuffering?: boolean;
  readonly maxBufferSize?: number;
  readonly flushIntervalMs?: number;
  readonly redactFields?: readonly string[];
  readonly samplingRate?: number;
}

export interface CreateExecutionParams {
  readonly model?: string;
  readonly provider?: string;
  readonly agentId?: string;
  readonly traceId?: string;
  readonly parentExecutionId?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ExecutionHandle {
  readonly executionId: string;
  readonly traceId: string;
  recordModelCall(params: ModelCallParams): void;
  recordToolCall(params: ToolCallParams): void;
  recordMemoryRead(params: MemoryOperationParams): void;
  recordMemoryWrite(params: MemoryOperationParams): void;
  recordEvent(params: EventParams): void;
  complete(params?: CompleteExecutionParams): Promise<void>;
  fail(params: FailExecutionParams): Promise<void>;
}

export interface SpanHandle {
  readonly spanId: string;
  end(): void;
  setAttribute(key: string, value: unknown): void;
}

export interface ModelCallParams {
  readonly model: string;
  readonly provider: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly latencyMs: number;
  readonly cost?: number;
  readonly input?: string;
  readonly output?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ToolCallParams {
  readonly toolName: string;
  readonly toolType: string;
  readonly input?: Record<string, unknown>;
  readonly output?: Record<string, unknown>;
  readonly latencyMs: number;
  readonly success: boolean;
  readonly error?: string;
}

export interface MemoryOperationParams {
  readonly memoryType: string;
  readonly query?: string;
  readonly results?: number;
  readonly latencyMs: number;
}

export interface EventParams {
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
}

export interface CompleteExecutionParams {
  readonly status?: "completed" | "failed" | "cancelled";
  readonly output?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
  readonly latencyMs?: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly estimatedCost?: number;
}

export interface FailExecutionParams {
  readonly error: string;
  readonly errorCode?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface SDKEvent {
  readonly event_id: string;
  readonly event_type: string;
  readonly execution_id: string;
  readonly organization_id: string;
  readonly project_id: string;
  readonly timestamp: string;
  readonly schema_version: string;
  readonly producer: string;
  readonly payload: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
}
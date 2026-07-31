import type { StratScopeConfig, CreateExecutionParams, ExecutionHandle } from "./types";
import { ExecutionHandleImpl } from "./execution";
import { EventBuffer } from "./buffer";

export class StratScopeClient {
  private readonly config: Required<Omit<StratScopeConfig, "redactFields" | "samplingRate">> & Pick<StratScopeConfig, "redactFields" | "samplingRate">;
  private readonly buffer: EventBuffer;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: StratScopeConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? "https://api.stratscope.dev",
      projectId: config.projectId,
      organizationId: config.organizationId,
      environment: config.environment ?? "production",
      sdkVersion: config.sdkVersion ?? "0.1.0",
      pipelineVersion: config.pipelineVersion ?? "1.0.0",
      enableOfflineBuffering: config.enableOfflineBuffering ?? true,
      maxBufferSize: config.maxBufferSize ?? 1000,
      flushIntervalMs: config.flushIntervalMs ?? 5000,
      redactFields: config.redactFields,
      samplingRate: config.samplingRate,
    };

    this.buffer = new EventBuffer(this.config.maxBufferSize);

    if (this.config.flushIntervalMs > 0) {
      this.flushTimer = setInterval(() => {
        void this.flush();
      }, this.config.flushIntervalMs);
    }
  }

  async startExecution(params: CreateExecutionParams = {}): Promise<ExecutionHandle> {
    const traceId = params.traceId ?? crypto.randomUUID();
    const executionId = crypto.randomUUID();

    const response = await this.request("POST", "/v1/executions", {
      project_id: this.config.projectId,
      agent_id: params.agentId,
      model: params.model ?? "unknown",
      provider: params.provider ?? "unknown",
      trace_id: traceId,
      parent_execution_id: params.parentExecutionId,
      sdk_version: this.config.sdkVersion,
      pipeline_version: this.config.pipelineVersion,
      metadata: {
        ...params.metadata,
        environment: this.config.environment,
      },
    });

    const data = response as { id: string; trace_id: string };

    return new ExecutionHandleImpl({
      executionId: data.id ?? executionId,
      traceId: data.trace_id ?? traceId,
      config: this.config,
      buffer: this.buffer,
      client: this,
    });
  }

  async flush(): Promise<void> {
    const events = this.buffer.drain();
    if (events.length === 0) return;

    try {
      await this.request("POST", "/v1/events", { batch: events });
    } catch {
      // Re-queue on failure
      for (const event of events) {
        this.buffer.push(event);
      }
    }
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const url = `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
      "X-Organization-ID": this.config.organizationId,
      "X-Project-ID": this.config.projectId,
      "X-SDK-Version": this.config.sdkVersion,
      "X-EIP-Version": "1.0.0",
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`StratScope API error: ${response.status} - ${error}`);
    }

    return response.json();
  }
}
import type { ExecutionContext, DecisionRecord, FailureRecord } from "../types.js";

export interface ExecutionStartData {
  readonly execution_id: string;
  readonly task_id: string;
  readonly task_type: string;
  readonly task_title: string;
  readonly model: string;
  readonly started_at: string;
}

export interface ExecutionCompleteData {
  readonly execution_id: string;
  readonly status: "completed" | "failed";
  readonly duration_ms: number;
  readonly tokens_used: number;
  readonly cost_usd: number;
  readonly tools_used: readonly string[];
  readonly completed_at: string;
}

export interface EvaluationData {
  readonly execution_id: string;
  readonly score: number;
  readonly issues: readonly { severity: string; description: string }[];
  readonly suggestions: readonly string[];
  readonly should_retry: boolean;
}

export interface ReflectionData {
  readonly execution_id: string;
  readonly what_worked: readonly string[];
  readonly what_failed: readonly string[];
  readonly improvements: readonly string[];
}

export class ExecutionRecorder {
  private apiBaseUrl: string;
  private apiKey: string;
  private projectId: string;
  private organizationId: string;
  private agentId: string;

  constructor(config: {
    apiBaseUrl: string;
    apiKey: string;
    projectId: string;
    organizationId: string;
    agentId: string;
  }) {
    this.apiBaseUrl = config.apiBaseUrl;
    this.apiKey = config.apiKey;
    this.projectId = config.projectId;
    this.organizationId = config.organizationId;
    this.agentId = config.agentId;
  }

  async recordExecutionStart(data: ExecutionStartData): Promise<void> {
    await this.post("/v1/executions", {
      id: data.execution_id,
      project_id: this.projectId,
      agent_id: this.agentId,
      input: JSON.stringify({
        task_id: data.task_id,
        task_type: data.task_type,
        task_title: data.task_title,
      }),
      model: data.model,
      metadata: JSON.stringify({
        task_id: data.task_id,
        task_type: data.task_type,
      }),
    });

    await this.recordEvent(data.execution_id, "execution.created", {
      task_id: data.task_id,
      model: data.model,
    });
  }

  async recordEvent(
    executionId: string,
    eventType: string,
    data: Record<string, unknown>
  ): Promise<void> {
    await this.post("/v1/events", {
      execution_id: executionId,
      event_type: eventType,
      service: "seea",
      payload: JSON.stringify(data),
      metadata: "{}",
    });
  }

  async recordToolCall(
    executionId: string,
    toolName: string,
    input: Record<string, unknown>,
    output: string,
    durationMs: number,
    success: boolean
  ): Promise<void> {
    await this.recordEvent(executionId, "tool.executed", {
      tool_name: toolName,
      input: JSON.stringify(input),
      output: output.substring(0, 1000),
      duration_ms: durationMs,
      success,
    });
  }

  async recordModelCall(
    executionId: string,
    model: string,
    promptTokens: number,
    completionTokens: number,
    latencyMs: number
  ): Promise<void> {
    await this.recordEvent(executionId, "model.called", {
      model,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      latency_ms: latencyMs,
    });
  }

  async recordDecision(
    context: ExecutionContext,
    decision: DecisionRecord
  ): Promise<void> {
    await this.recordEvent(context.executionId, "decision.made", {
      decision_id: decision.id,
      type: decision.type,
      alternatives: decision.alternatives,
      selected: decision.selected,
      reason: decision.reason,
      confidence: decision.confidence,
    });
  }

  async recordFailure(
    context: ExecutionContext,
    failure: FailureRecord
  ): Promise<void> {
    await this.recordEvent(context.executionId, "failure.recorded", {
      failure_id: failure.id,
      type: failure.type,
      component: failure.component,
      root_cause: failure.root_cause,
      recovery_strategy: failure.recovery_strategy,
      recovery_success: failure.recovery_success,
      retry_count: failure.retry_count,
    });
  }

  async recordEvaluation(data: EvaluationData): Promise<void> {
    await this.post("/v1/evaluations", {
      execution_id: data.execution_id,
      scores: JSON.stringify([
        { dimension: "overall", score: data.score },
      ]),
      overall_score: data.score,
      source: "automated",
      notes: JSON.stringify({
        issues: data.issues,
        suggestions: data.suggestions,
        should_retry: data.should_retry,
      }),
    });
  }

  async recordReflection(data: ReflectionData): Promise<void> {
    await this.post("/v1/reflections", {
      execution_id: data.execution_id,
      summary: JSON.stringify(data),
      what_worked: JSON.stringify(data.what_worked),
      what_failed: JSON.stringify(data.what_failed),
      improvements: JSON.stringify(data.improvements),
    });
  }

  async recordExecutionComplete(
    context: ExecutionContext,
    data: ExecutionCompleteData
  ): Promise<void> {
    await this.recordEvent(context.executionId, "execution.completed", {
      status: data.status,
      duration_ms: data.duration_ms,
      tokens_used: data.tokens_used,
      cost_usd: data.cost_usd,
      tools_used: data.tools_used,
    });
  }

  private async post(path: string, body: Record<string, unknown>): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}${path}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        console.error(`[Recorder] API error: ${response.status} ${path}`);
      }
    } catch (error) {
      console.error(`[Recorder] Failed to record to API:`, error);
    }
  }
}

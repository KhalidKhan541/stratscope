import type { ExecutionContext, DecisionRecord, FailureRecord } from "../types.js";
import type { ExecutionStartData, ExecutionCompleteData, EvaluationData, ReflectionData } from "./ExecutionRecorder.js";

export class CloudflareRecorder {
  private apiBaseUrl: string;
  private apiKey: string;

  constructor(apiBaseUrl: string, apiKey: string) {
    this.apiBaseUrl = apiBaseUrl;
    this.apiKey = apiKey;
  }

  async recordExecutionStart(data: ExecutionStartData): Promise<void> {
    await this.post("/v1/seea/records", {
      execution_id: data.execution_id,
      task_id: data.task_id,
      task_type: data.task_type,
      task_title: data.task_title,
      model: data.model,
      status: "running",
      duration_ms: 0,
      tokens_used: 0,
      cost_usd: 0,
      tools_used: [],
      errors: [],
      retry_count: 0,
      output: "",
    });
  }

  async recordEvent(executionId: string, eventType: string, data: Record<string, unknown>): Promise<void> {
    await this.post("/v1/seea/events", {
      execution_id: executionId,
      event_type: eventType,
      service: "seea",
      payload: JSON.stringify(data),
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

  async recordDecision(context: ExecutionContext, decision: DecisionRecord): Promise<void> {
    await this.recordEvent(context.executionId, "decision.made", {
      type: decision.type,
      selected: decision.selected,
      reason: decision.reason,
    });
  }

  async recordFailure(context: ExecutionContext, failure: FailureRecord): Promise<void> {
    await this.recordEvent(context.executionId, "failure.recorded", {
      type: failure.type,
      root_cause: failure.root_cause,
      recovery_success: failure.recovery_success,
    });
  }

  async recordEvaluation(data: EvaluationData): Promise<void> {
    await this.post("/v1/seea/events", {
      execution_id: data.execution_id,
      event_type: "evaluation.completed",
      service: "seea",
      payload: JSON.stringify({
        score: data.score,
        issues: data.issues,
        suggestions: data.suggestions,
      }),
    });
  }

  async recordReflection(data: ReflectionData): Promise<void> {
    await this.post("/v1/seea/events", {
      execution_id: data.execution_id,
      event_type: "reflection.completed",
      service: "seea",
      payload: JSON.stringify({
        what_worked: data.what_worked,
        what_failed: data.what_failed,
        improvements: data.improvements,
      }),
    });
  }

  async recordExecutionComplete(context: ExecutionContext, data: ExecutionCompleteData): Promise<void> {
    await this.recordEvent(context.executionId, "execution.completed", {
      status: data.status,
      duration_ms: data.duration_ms,
      tokens_used: data.tokens_used,
      cost_usd: data.cost_usd,
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
        console.error(`[CloudflareRecorder] API error: ${response.status}`);
      }
    } catch (error) {
      console.error(`[CloudflareRecorder] Failed:`, error);
    }
  }
}

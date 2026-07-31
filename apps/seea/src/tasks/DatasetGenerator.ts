import type {
  TaskResult,
  ExecutionContext,
  DecisionRecord,
  FailureRecord,
  EvaluationResult,
  ReflectionResult,
} from "../types.js";

export interface DatasetRecord {
  readonly id: string;
  readonly task_id: string;
  readonly task_type: string;
  readonly task_difficulty: string;
  readonly model_used: string;
  readonly tools_used: readonly string[];
  readonly status: string;
  readonly score: number;
  readonly duration_ms: number;
  readonly tokens_used: number;
  readonly cost_usd: number;
  readonly retry_count: number;
  readonly errors: readonly string[];
  readonly decisions: readonly DecisionRecord[];
  readonly failures: readonly FailureRecord[];
  readonly evaluation: EvaluationResult;
  readonly reflection: ReflectionResult;
  readonly created_at: string;
}

export interface DatasetMetadata {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly record_count: number;
  readonly schema_hash: string;
  readonly created_at: string;
}

export class DatasetGenerator {
  private records: DatasetRecord[] = [];

  addRecord(
    taskResult: TaskResult,
    context: ExecutionContext,
    evaluation: EvaluationResult,
    reflection: ReflectionResult
  ): void {
    const record: DatasetRecord = {
      id: crypto.randomUUID(),
      task_id: taskResult.task_id,
      task_type: taskResult.model_used ? "unknown" : "unknown",
      task_difficulty: "unknown",
      model_used: taskResult.model_used,
      tools_used: taskResult.tools_used,
      status: taskResult.status,
      score: evaluation.score,
      duration_ms: taskResult.duration_ms,
      tokens_used: taskResult.tokens_used,
      cost_usd: taskResult.cost_usd,
      retry_count: taskResult.retry_count,
      errors: taskResult.errors,
      decisions: context.decisions,
      failures: context.failures,
      evaluation,
      reflection,
      created_at: new Date().toISOString(),
    };

    this.records.push(record);
  }

  getRecords(): readonly DatasetRecord[] {
    return this.records;
  }

  getMetadata(): DatasetMetadata {
    return {
      name: "seea-execution-dataset",
      version: "1.0.0",
      description: "Software Engineering Execution Agent dataset",
      record_count: this.records.length,
      schema_hash: this.computeSchemaHash(),
      created_at: new Date().toISOString(),
    };
  }

  exportJSONL(): string {
    return this.records
      .map(r => JSON.stringify(r))
      .join("\n");
  }

  exportJSON(): string {
    return JSON.stringify({
      metadata: this.getMetadata(),
      records: this.records,
    }, null, 2);
  }

  private computeSchemaHash(): string {
    const schema = JSON.stringify({
      fields: [
        "id", "task_id", "task_type", "model_used", "tools_used",
        "status", "score", "duration_ms", "tokens_used", "cost_usd",
        "decisions", "failures", "evaluation", "reflection",
      ],
    });
    let hash = 0;
    for (let i = 0; i < schema.length; i++) {
      const char = schema.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash.toString(16);
  }
}

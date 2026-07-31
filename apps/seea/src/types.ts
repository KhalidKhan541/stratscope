export type TaskType =
  | "bug_fix"
  | "feature_implementation"
  | "refactoring"
  | "test_generation"
  | "documentation"
  | "code_review"
  | "dependency_upgrade"
  | "security_review"
  | "performance_optimization";

export type TaskStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";

export interface Task {
  readonly id: string;
  readonly type: TaskType;
  readonly title: string;
  readonly description: string;
  readonly repository: string;
  readonly file_paths: readonly string[];
  readonly difficulty: "easy" | "medium" | "hard";
  readonly tags: readonly string[];
  readonly created_at: string;
}

export interface TaskResult {
  readonly task_id: string;
  readonly status: TaskStatus;
  readonly output: string;
  readonly changes: readonly FileChange[];
  readonly duration_ms: number;
  readonly tokens_used: number;
  readonly cost_usd: number;
  readonly model_used: string;
  readonly tools_used: readonly string[];
  readonly errors: readonly string[];
  readonly retry_count: number;
}

export interface FileChange {
  readonly path: string;
  readonly action: "create" | "modify" | "delete";
  readonly content: string;
  readonly diff: string;
}

export interface AgentConfig {
  readonly apiBaseUrl: string;
  readonly apiKey: string;
  readonly projectId: string;
  readonly organizationId: string;
  readonly agentId: string;
  readonly maxRetries: number;
  readonly maxTokens: number;
  readonly model: string;
  readonly workspaceDir: string;
}

export interface ExecutionEvent {
  readonly type: string;
  readonly execution_id: string;
  readonly timestamp: string;
  readonly data: Record<string, unknown>;
}

export interface ExecutionContext {
  readonly executionId: string;
  readonly taskId: string;
  readonly startTime: number;
  readonly events: ExecutionEvent[];
  readonly decisions: DecisionRecord[];
  readonly failures: FailureRecord[];
}

export interface DecisionRecord {
  readonly id: string;
  readonly type: string;
  readonly alternatives: readonly string[];
  readonly selected: string;
  readonly reason: string;
  readonly confidence: number;
}

export interface FailureRecord {
  readonly id: string;
  readonly type: string;
  readonly component: string;
  readonly root_cause: string;
  readonly recovery_strategy: string;
  readonly recovery_success: boolean;
  readonly retry_count: number;
}

export interface Plan {
  readonly steps: readonly PlanStep[];
  readonly estimated_duration_ms: number;
  readonly risk_level: "low" | "medium" | "high";
}

export interface PlanStep {
  readonly id: string;
  readonly action: string;
  readonly tool: string;
  readonly args: Record<string, unknown>;
  readonly depends_on: readonly string[];
}

export interface ToolResult {
  readonly success: boolean;
  readonly output: string;
  readonly error?: string;
  readonly duration_ms: number;
}

export interface EvaluationResult {
  readonly score: number;
  readonly dimensions: readonly EvaluationDimension[];
  readonly pass: boolean;
  readonly feedback: string;
}

export interface EvaluationDimension {
  readonly name: string;
  readonly score: number;
  readonly weight: number;
  readonly feedback: string;
}

export interface ReflectionResult {
  readonly insights: readonly string[];
  readonly lessons_learned: readonly string[];
  readonly recommendations: readonly string[];
  readonly confidence: number;
}

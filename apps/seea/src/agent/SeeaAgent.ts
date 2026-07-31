import type {
  Task,
  TaskResult,
  AgentConfig,
  ExecutionContext,
  DecisionRecord,
  FailureRecord,
  Plan,
} from "../types.js";
import type { EvaluationResult } from "../evaluator/Evaluator.js";
import type { ReflectionResult } from "../reflector/Reflector.js";
import type { ExecutionStartData, ExecutionCompleteData, EvaluationData, ReflectionData } from "../recorder/ExecutionRecorder.js";
import { createInitialState, type AgentState, updateState } from "./AgentState.js";

export interface Recorder {
  recordExecutionStart(data: ExecutionStartData): Promise<void>;
  recordDecision(context: ExecutionContext, decision: DecisionRecord): Promise<void>;
  recordExecutionComplete(context: ExecutionContext, data: ExecutionCompleteData): Promise<void>;
  recordFailure(context: ExecutionContext, failure: FailureRecord): Promise<void>;
  recordEvaluation(data: EvaluationData): Promise<void>;
  recordReflection(data: ReflectionData): Promise<void>;
}

export interface Planner {
  plan(task: Task): Promise<Plan>;
}

export interface Evaluator {
  evaluate(result: TaskResult, context: ExecutionContext): Promise<EvaluationResult>;
}

export interface Reflector {
  reflect(
    result: TaskResult,
    evaluation: EvaluationResult,
    context: ExecutionContext,
  ): Promise<ReflectionResult>;
}

export interface TaskPicker {
  pickTask(): Promise<Task | null>;
}

export interface TaskExecutor {
  executePlan(task: Task, plan: Plan, context: ExecutionContext): Promise<TaskResult>;
}

export interface SeeaAgentDeps {
  readonly recorder: Recorder;
  readonly planner: Planner;
  readonly evaluator: Evaluator;
  readonly reflector: Reflector;
  readonly taskPicker: TaskPicker;
  readonly taskExecutor: TaskExecutor;
}

export class SeeaAgent {
  private config: AgentConfig;
  private state: AgentState;
  private deps: SeeaAgentDeps | null = null;

  constructor(config: AgentConfig) {
    this.config = config;
    this.state = createInitialState();
  }

  injectDeps(deps: SeeaAgentDeps): void {
    this.deps = deps;
  }

  getState(): AgentState {
    return this.state;
  }

  async run(): Promise<TaskResult | null> {
    if (!this.deps) {
      throw new Error("Dependencies not injected. Call injectDeps() before run().");
    }

    console.log("[SEEA] Starting execution run");

    const task = await this.deps.taskPicker.pickTask();
    if (!task) {
      console.log("[SEEA] No tasks available");
      return null;
    }

    console.log(`[SEEA] Picked task: ${task.title} (${task.type})`);

    const context = this.createExecutionContext(task);
    this.state = updateState(this.state, { currentTask: task, context });

    await this.deps.recorder.recordExecutionStart({
      execution_id: context.executionId,
      task_id: task.id,
      task_type: task.type,
      task_title: task.title,
      model: "",
      started_at: new Date().toISOString(),
    });

    try {
      const plan = await this.deps.planner.plan(task);
      await this.deps.recorder.recordDecision(context, {
        id: crypto.randomUUID(),
        type: "planning",
        alternatives: ["direct", "planned"],
        selected: "planned",
        reason: "Task requires decomposition into steps",
        confidence: 0.8,
      });

      const result = await this.deps.taskExecutor.executePlan(task, plan, context);

      const evaluation = await this.deps.evaluator.evaluate(result, context);
      const reflection = await this.deps.reflector.reflect(result, evaluation, context);

      await this.deps.recorder.recordExecutionComplete(context, {
        execution_id: context.executionId,
        status: result.status === "completed" ? "completed" : "failed",
        duration_ms: result.duration_ms,
        tokens_used: result.tokens_used,
        cost_usd: result.cost_usd,
        tools_used: result.tools_used,
        completed_at: new Date().toISOString(),
      });

      await this.deps.recorder.recordEvaluation({
        execution_id: context.executionId,
        score: evaluation.score,
        issues: evaluation.issues.map((i) => ({ severity: i.severity, description: i.description })),
        suggestions: evaluation.suggestions,
        should_retry: evaluation.should_retry,
      });

      await this.deps.recorder.recordReflection({
        execution_id: context.executionId,
        what_worked: [...reflection.what_worked],
        what_failed: [...reflection.what_failed],
        improvements: [...reflection.improvements],
      });

      this.state = updateState(this.state, {
        currentResult: result,
        completedTasks: [...this.state.completedTasks, task],
        totalTokensUsed: this.state.totalTokensUsed + result.tokens_used,
        totalCostUsd: this.state.totalCostUsd + result.cost_usd,
      });

      console.log(`[SEEA] Task completed: ${task.title}`);
      return result;
    } catch (error) {
      const failure: FailureRecord = {
        id: crypto.randomUUID(),
        type: "execution_error",
        component: "agent",
        root_cause: error instanceof Error ? error.message : String(error),
        recovery_strategy: "none",
        recovery_success: false,
        retry_count: 0,
      };

      await this.deps.recorder.recordFailure(context, failure);

      this.state = updateState(this.state, {
        failedTasks: [...this.state.failedTasks, task],
      });

      console.error(`[SEEA] Task failed: ${task.title}`, error);
      return null;
    }
  }

  private createExecutionContext(task: Task): ExecutionContext {
    return {
      executionId: crypto.randomUUID(),
      taskId: task.id,
      startTime: Date.now(),
      events: [],
      decisions: [],
      failures: [],
    };
  }
}

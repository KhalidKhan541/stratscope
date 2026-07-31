import type { Task, TaskResult, ExecutionContext } from "../types.js";

export interface AgentState {
  readonly currentTask: Task | null;
  readonly currentResult: TaskResult | null;
  readonly context: ExecutionContext | null;
  readonly completedTasks: readonly Task[];
  readonly failedTasks: readonly Task[];
  readonly totalTokensUsed: number;
  readonly totalCostUsd: number;
  readonly startTime: number;
}

export function createInitialState(): AgentState {
  return {
    currentTask: null,
    currentResult: null,
    context: null,
    completedTasks: [],
    failedTasks: [],
    totalTokensUsed: 0,
    totalCostUsd: 0,
    startTime: Date.now(),
  };
}

export function updateState(state: AgentState, update: Partial<AgentState>): AgentState {
  return { ...state, ...update };
}

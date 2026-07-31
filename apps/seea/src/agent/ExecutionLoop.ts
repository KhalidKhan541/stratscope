import type { AgentConfig, Task, TaskResult } from "../types.js";
import { SeeaAgent, type SeeaAgentDeps } from "./SeeaAgent.js";

export interface ExecutionLoopConfig extends AgentConfig {
  readonly maxIterations: number;
  readonly delayBetweenIterationsMs: number;
}

export class ExecutionLoop {
  private config: ExecutionLoopConfig;
  private depsFactory: () => SeeaAgentDeps;
  private iterations: number;

  constructor(config: ExecutionLoopConfig, depsFactory: () => SeeaAgentDeps) {
    this.config = config;
    this.depsFactory = depsFactory;
    this.iterations = 0;
  }

  async run(): Promise<ExecutionLoopResult> {
    console.log(`[SEEA] Starting execution loop (max ${this.config.maxIterations} iterations)`);

    const results: TaskResult[] = [];
    const failures: string[] = [];

    while (this.iterations < this.config.maxIterations) {
      this.iterations++;
      console.log(`[SEEA] Iteration ${this.iterations}/${this.config.maxIterations}`);

      const agent = new SeeaAgent(this.config);
      agent.injectDeps(this.depsFactory());

      const result = await agent.run();
      if (result) {
        results.push(result);
      } else {
        const state = agent.getState();
        const failedTask = state.failedTasks[state.failedTasks.length - 1];
        if (failedTask) {
          failures.push(failedTask.id);
        }
      }

      if (this.iterations < this.config.maxIterations) {
        await this.delay(this.config.delayBetweenIterationsMs);
      }
    }

    console.log("[SEEA] Execution loop complete");

    return {
      totalIterations: this.iterations,
      successfulTasks: results.length,
      failedTasks: failures.length,
      results,
      failures,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export interface ExecutionLoopResult {
  readonly totalIterations: number;
  readonly successfulTasks: number;
  readonly failedTasks: number;
  readonly results: readonly TaskResult[];
  readonly failures: readonly string[];
}

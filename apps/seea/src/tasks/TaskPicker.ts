import type { Task, TaskType } from "../types.js";
import { TaskPool } from "./TaskPool.js";

export type SelectionStrategy = "random" | "round_robin" | "by_difficulty" | "by_type";

export class TaskPicker {
  private pool: TaskPool;
  private strategy: SelectionStrategy;
  private lastIndex: number = 0;
  private typeFilter?: TaskType;

  constructor(pool: TaskPool, strategy: SelectionStrategy = "random") {
    this.pool = pool;
    this.strategy = strategy;
  }

  setTypeFilter(type: TaskType): void {
    this.typeFilter = type;
  }

  async pick(): Promise<Task | null> {
    switch (this.strategy) {
      case "random":
        return this.pool.pickRandom();
      
      case "round_robin":
        return this.pickRoundRobin();
      
      case "by_difficulty":
        return this.pickByDifficulty();
      
      case "by_type":
        return this.typeFilter 
          ? this.pool.pickByType(this.typeFilter)
          : this.pool.pickRandom();
      
      default:
        return this.pool.pickRandom();
    }
  }

  private async pickRoundRobin(): Promise<Task | null> {
    const task = await this.pool.pickRandom();
    this.lastIndex++;
    return task;
  }

  private async pickByDifficulty(): Promise<Task | null> {
    const stats = this.pool.getStats();
    if (stats.completed < 3) {
      return this.pool.pickByType("bug_fix");
    } else if (stats.completed < 7) {
      return this.pool.pickByType("feature_implementation");
    } else {
      return this.pool.pickRandom();
    }
  }
}

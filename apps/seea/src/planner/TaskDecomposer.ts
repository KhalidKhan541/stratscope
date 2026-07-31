import type { Task } from "../types.js";
import type { ModelRouter } from "../model/ModelRouter.js";
import { SYSTEM_PROMPTS } from "../model/AgentPrompts.js";
import type { PlanStep } from "./Planner.js";

export interface SubTask {
  readonly id: string;
  readonly parent_task_id: string;
  readonly description: string;
  readonly type: string;
  readonly priority: number;
  readonly dependencies: readonly string[];
  readonly estimated_complexity: "easy" | "medium" | "hard";
  readonly status: "pending" | "in_progress" | "completed" | "failed";
  readonly assigned_tools: readonly string[];
  readonly completion_criteria: string;
}

export class TaskDecomposer {
  private modelRouter: ModelRouter;

  constructor(modelRouter: ModelRouter) {
    this.modelRouter = modelRouter;
  }

  async decompose(task: Task, plan: PlanStep[]): Promise<readonly SubTask[]> {
    const response = await this.modelRouter.route({
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.planner },
        {
          role: "user",
          content: `Decompose this task into subtasks:\n\nTask: ${task.title}\n${task.description}\n\nPlan steps: ${JSON.stringify(plan, null, 2)}`,
        },
      ],
      temperature: 0.3,
    });

    const parsed = this.parseSubTasks(response.content);

    return parsed.map((s: any, i: number) => ({
      id: `subtask_${i}`,
      parent_task_id: task.id,
      description: s.description,
      type: s.type || "implementation",
      priority: s.priority || i,
      dependencies: s.dependencies || [],
      estimated_complexity: s.estimated_complexity || "medium",
      status: "pending" as const,
      assigned_tools: s.assigned_tools || ["read_file", "write_file"],
      completion_criteria: s.completion_criteria || "Task completed successfully",
    }));
  }

  private parseSubTasks(content: string): any[] {
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Fall back
    }

    return [
      {
        description: "Analyze the codebase and understand the problem",
        type: "analysis",
        priority: 0,
        assigned_tools: ["read_file", "list_files", "search_files"],
        completion_criteria: "Problem understood and solution approach identified",
      },
      {
        description: "Implement the solution",
        type: "implementation",
        priority: 1,
        dependencies: ["subtask_0"],
        assigned_tools: ["read_file", "write_file"],
        completion_criteria: "Solution implemented",
      },
      {
        description: "Verify the solution works",
        type: "verification",
        priority: 2,
        dependencies: ["subtask_1"],
        assigned_tools: ["terminal", "test_runner"],
        completion_criteria: "Tests pass and no errors",
      },
    ];
  }
}

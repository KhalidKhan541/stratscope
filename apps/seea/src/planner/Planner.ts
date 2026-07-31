import type { Task } from "../types.js";
import type { ModelRouter } from "../model/ModelRouter.js";
import { SYSTEM_PROMPTS } from "../model/AgentPrompts.js";

export interface PlanStep {
  readonly id: string;
  readonly action: string;
  readonly target: string;
  readonly reason: string;
  readonly dependencies: readonly string[];
  readonly tools_required: readonly string[];
  readonly status: "pending" | "in_progress" | "completed" | "failed";
  readonly output?: string;
}

export interface Plan {
  readonly task_id: string;
  readonly steps: readonly PlanStep[];
  readonly estimated_complexity: "easy" | "medium" | "hard";
  readonly required_tools: readonly string[];
  readonly risk_assessment: string;
  readonly created_at: string;
}

export class Planner {
  private modelRouter: ModelRouter;

  constructor(modelRouter: ModelRouter) {
    this.modelRouter = modelRouter;
  }

  async plan(task: Task): Promise<Plan> {
    const response = await this.modelRouter.route({
      messages: [
        { role: "system", content: SYSTEM_PROMPTS.planner },
        { role: "user", content: this.formatTask(task) },
      ],
      temperature: 0.3,
    });

    const parsed = this.parsePlan(response.content);

    return {
      task_id: task.id,
      steps: parsed.steps.map((s: any, i: number) => ({
        id: `step_${i}`,
        action: s.action,
        target: s.target,
        reason: s.reason,
        dependencies: s.dependencies || [],
        tools_required: s.tools_required || [],
        status: "pending" as const,
      })),
      estimated_complexity: parsed.estimated_complexity || "medium",
      required_tools: parsed.required_tools || [],
      risk_assessment: parsed.risk_assessment || "Unknown",
      created_at: new Date().toISOString(),
    };
  }

  private formatTask(task: Task): string {
    return `Task: ${task.title}
Type: ${task.type}
Description: ${task.description}
Repository: ${task.repository}
Files: ${task.file_paths.join(", ")}
Difficulty: ${task.difficulty}`;
  }

  private parsePlan(content: string): any {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Fall back to default plan
    }

    return {
      steps: [
        { action: "analyze", target: "codebase", reason: "Understand the problem" },
        { action: "implement", target: "solution", reason: "Implement the fix" },
        { action: "test", target: "tests", reason: "Verify the solution" },
      ],
      estimated_complexity: "medium",
      required_tools: ["read_file", "write_file", "terminal"],
      risk_assessment: "Standard implementation",
    };
  }
}

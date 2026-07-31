import type { TaskResult, ExecutionContext } from "../types.js";
import type { EvaluationResult } from "../evaluator/Evaluator.js";
import type { ModelRouter } from "../model/ModelRouter.js";
import { SYSTEM_PROMPTS } from "../model/AgentPrompts.js";

export interface ReflectionResult {
  readonly what_worked: readonly string[];
  readonly what_failed: readonly string[];
  readonly what_slowed_down: readonly string[];
  readonly tools_effective: readonly ToolEffectiveness[];
  readonly model_choices_effective: readonly ModelEffectiveness[];
  readonly improvements: readonly string[];
  readonly summary: string;
}

export interface ToolEffectiveness {
  readonly tool: string;
  readonly reason: string;
  readonly used_count: number;
}

export interface ModelEffectiveness {
  readonly model: string;
  readonly reason: string;
  readonly tokens_used: number;
}

export class Reflector {
  private modelRouter: ModelRouter;

  constructor(modelRouter: ModelRouter) {
    this.modelRouter = modelRouter;
  }

  async reflect(
    result: TaskResult,
    evaluation: EvaluationResult,
    context: ExecutionContext,
  ): Promise<ReflectionResult> {
    const ruleBased = this.ruleBasedReflection(result, context);
    const llmReflection = await this.llmReflect(result, evaluation, context);

    return {
      what_worked: [...ruleBased.what_worked, ...llmReflection.what_worked],
      what_failed: [...ruleBased.what_failed, ...llmReflection.what_failed],
      what_slowed_down: [...ruleBased.what_slowed_down, ...llmReflection.what_slowed_down],
      tools_effective: ruleBased.tools_effective,
      model_choices_effective: ruleBased.model_choices_effective,
      improvements: llmReflection.improvements,
      summary: llmReflection.summary,
    };
  }

  private ruleBasedReflection(
    result: TaskResult,
    _context: ExecutionContext,
  ): Omit<ReflectionResult, "improvements" | "summary"> {
    const whatWorked: string[] = [];
    const whatFailed: string[] = [];
    const whatSlowedDown: string[] = [];

    if (result.status === "completed") {
      whatWorked.push("Task completed successfully");
    }

    if (result.retry_count > 0) {
      whatFailed.push(`Required ${result.retry_count} retries`);
      whatSlowedDown.push("Retries increased execution time");
    }

    if (result.errors.length > 0) {
      whatFailed.push(`${result.errors.length} errors encountered`);
    }

    if (result.duration_ms > 60000) {
      whatSlowedDown.push("Execution took over 1 minute");
    }

    const toolCounts = new Map<string, number>();
    for (const tool of result.tools_used) {
      toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1);
    }

    const toolsEffective: ToolEffectiveness[] = Array.from(toolCounts.entries()).map(
      ([tool, count]) => ({
        tool,
        reason: `Used ${count} times`,
        used_count: count,
      }),
    );

    return {
      what_worked: whatWorked,
      what_failed: whatFailed,
      what_slowed_down: whatSlowedDown,
      tools_effective: toolsEffective,
      model_choices_effective: [
        {
          model: result.model_used,
          reason: "Selected for task",
          tokens_used: result.tokens_used,
        },
      ],
    };
  }

  private async llmReflect(
    result: TaskResult,
    evaluation: EvaluationResult,
    _context: ExecutionContext,
  ): Promise<{
    what_worked: string[];
    what_failed: string[];
    what_slowed_down: string[];
    improvements: string[];
    summary: string;
  }> {
    try {
      const response = await this.modelRouter.route({
        messages: [
          { role: "system", content: SYSTEM_PROMPTS.reflector },
          {
            role: "user",
            content: `Task: ${result.task_id}
Status: ${result.status}
Score: ${evaluation.score}
Duration: ${result.duration_ms}ms
Tokens: ${result.tokens_used}
Tools: ${result.tools_used.join(", ")}
Errors: ${result.errors.join("\n")}
Issues: ${evaluation.issues.map((i) => i.description).join("\n")}`,
          },
        ],
        temperature: 0.3,
      });

      const parsed = this.parseReflection(response.content);
      return {
        what_worked: Array.isArray(parsed.what_worked) ? parsed.what_worked : [],
        what_failed: Array.isArray(parsed.what_failed) ? parsed.what_failed : [],
        what_slowed_down: Array.isArray(parsed.what_slowed_down) ? parsed.what_slowed_down : [],
        improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
        summary: typeof parsed.summary === "string" ? parsed.summary : "Reflection completed",
      };
    } catch {
      return {
        what_worked: [],
        what_failed: ["LLM reflection failed"],
        what_slowed_down: [],
        improvements: [],
        summary: "Reflection failed due to LLM error",
      };
    }
  }

  private parseReflection(content: string): {
    what_worked?: string[];
    what_failed?: string[];
    what_slowed_down?: string[];
    improvements?: string[];
    summary?: string;
  } {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Fall back
    }
    return {
      what_worked: [],
      what_failed: [],
      what_slowed_down: [],
      improvements: [],
      summary: content.substring(0, 500),
    };
  }
}

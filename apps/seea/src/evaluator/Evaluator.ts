import type { TaskResult, ExecutionContext } from "../types.js";
import type { ModelRouter } from "../model/ModelRouter.js";
import { SYSTEM_PROMPTS } from "../model/AgentPrompts.js";

export interface EvaluationResult {
  readonly score: number;
  readonly issues: readonly Issue[];
  readonly suggestions: readonly string[];
  readonly should_retry: boolean;
  readonly metrics: EvaluationMetrics;
}

export interface Issue {
  readonly severity: "error" | "warning" | "info";
  readonly description: string;
  readonly file?: string;
  readonly line?: number;
}

export interface EvaluationMetrics {
  readonly task_completion: number;
  readonly code_quality: number;
  readonly test_success: boolean;
  readonly build_success: boolean;
  readonly security_findings: readonly string[];
  readonly performance_impact: string;
  readonly execution_duration_ms: number;
  readonly cost_usd: number;
  readonly tokens_used: number;
}

export class Evaluator {
  private modelRouter: ModelRouter;

  constructor(modelRouter: ModelRouter) {
    this.modelRouter = modelRouter;
  }

  async evaluate(
    result: TaskResult,
    context: ExecutionContext,
  ): Promise<EvaluationResult> {
    const metrics = this.computeMetrics(result, context);
    const llmEvaluation = await this.llmEvaluate(result, context);

    return {
      score: this.computeScore(metrics, llmEvaluation),
      issues: llmEvaluation.issues,
      suggestions: llmEvaluation.suggestions,
      should_retry: metrics.task_completion < 70 || !metrics.test_success,
      metrics,
    };
  }

  private computeMetrics(
    result: TaskResult,
    _context: ExecutionContext,
  ): EvaluationMetrics {
    const hasTests = result.tools_used.includes("test_runner");
    const hasLint = result.tools_used.includes("lint_runner");
    const hasErrors = result.errors.length > 0;

    return {
      task_completion: result.status === "completed" ? 100 : 0,
      code_quality: hasLint ? 80 : 50,
      test_success: hasTests && !hasErrors,
      build_success: !hasErrors,
      security_findings: [],
      performance_impact: "unknown",
      execution_duration_ms: result.duration_ms,
      cost_usd: result.cost_usd,
      tokens_used: result.tokens_used,
    };
  }

  private async llmEvaluate(
    result: TaskResult,
    _context: ExecutionContext,
  ): Promise<{ issues: Issue[]; suggestions: string[] }> {
    try {
      const response = await this.modelRouter.route({
        messages: [
          { role: "system", content: SYSTEM_PROMPTS.evaluator },
          {
            role: "user",
            content: `Task: ${result.task_id}
Status: ${result.status}
Output: ${result.output}
Errors: ${result.errors.join("\n")}
Tools used: ${result.tools_used.join(", ")}`,
          },
        ],
        temperature: 0.2,
      });

      const parsed = this.parseEvaluation(response.content);
      return {
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      };
    } catch {
      return { issues: [], suggestions: [] };
    }
  }

  private parseEvaluation(content: string): {
    issues?: Issue[];
    suggestions?: string[];
  } {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Fall back
    }
    return { issues: [], suggestions: [] };
  }

  private computeScore(
    metrics: EvaluationMetrics,
    llmEval: { issues: Issue[]; suggestions: string[] },
  ): number {
    let score = 0;

    score += metrics.task_completion * 0.4;
    score += (metrics.test_success ? 100 : 0) * 0.2;
    score += (metrics.build_success ? 100 : 0) * 0.15;
    score += metrics.code_quality * 0.15;

    const errorCount = llmEval.issues.filter((i) => i.severity === "error").length;
    const warningCount = llmEval.issues.filter((i) => i.severity === "warning").length;
    score -= errorCount * 5;
    score -= warningCount * 2;

    return Math.max(0, Math.min(100, Math.round(score)));
  }
}

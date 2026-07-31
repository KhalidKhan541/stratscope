/**
 * Evaluation Service — measures execution quality across multiple dimensions.
 *
 * Responsible for evaluating executions, computing quality metrics,
 * and persisting evaluation results. Evaluations are the first layer
 * of intelligence built on top of raw execution history.
 *
 * This service follows the Evaluation Specification and produces
 * immutable evaluation records that downstream services consume.
 */

import { z } from "zod";
import type {
  ExecutionId,
  EvaluationId,
  ProjectId,
} from "@stratscope/core";
import type { Result } from "@stratscope/core";
import { ok, err } from "@stratscope/core";
import type { AppError } from "@stratscope/core";
import { validationError, notFoundError, internalError } from "@stratscope/core";
import type { Logger } from "@stratscope/core";
import type { Execution } from "@stratscope/core/src/domain/execution/Execution";
import type { Evaluation } from "@stratscope/core/src/domain/evaluation/Evaluation";
import type { EventStore, DomainEvent } from "@stratscope/events";
import { createEventId, CURRENT_SCHEMA_VERSION } from "@stratscope/events";
import type { IExecutionRepository } from "../repositories/ExecutionRepository";
import type { IEvaluationRepository, PaginationOptions, PaginatedResult } from "../repositories/EvaluationRepository";

/** Metrics computed by the evaluation service. */
export interface EvaluationMetrics {
  readonly accuracy: number;
  readonly goal_completion: number;
  readonly hallucination_score: number;
  readonly confidence: number;
  readonly cost_efficiency: number;
  readonly latency_score: number;
  readonly safety_score: number;
}

/**
 * LLM provider interface for content analysis.
 */
export interface LLMProvider {
  readonly name: string;
  complete(prompt: string): Promise<string>;
}

/**
 * Service interface for evaluation operations.
 */
export interface IEvaluationService {
  evaluateExecution(executionId: ExecutionId): Promise<Result<Evaluation>>;
  getEvaluation(id: string): Promise<Result<Evaluation>>;
  listByExecution(executionId: ExecutionId): Promise<Result<Evaluation[]>>;
  listByProject(projectId: ProjectId, options: PaginationOptions): Promise<Result<PaginatedResult<Evaluation>>>;
  compare(evaluationIds: string[]): Promise<Result<ComparisonResult>>;
}

/**
 * Result of comparing multiple evaluations.
 */
export interface ComparisonResult {
  readonly evaluations: readonly Evaluation[];
  readonly averages: EvaluationMetrics;
  readonly best: {
    readonly evaluation_id: EvaluationId;
    readonly score: number;
  };
  readonly worst: {
    readonly evaluation_id: EvaluationId;
    readonly score: number;
  };
}

/** Zod schema for evaluation ID validation. */
const EvaluationIdSchema = z.string().min(1);

/** Zod schema for comparison input validation. */
const ComparisonSchema = z.object({
  evaluationIds: z.array(z.string().min(1)).min(2).max(10),
});

/** Default expected latency in milliseconds for scoring. */
const DEFAULT_EXPECTED_LATENCY_MS = 5000;

/** Default maximum expected cost for scoring. */
const DEFAULT_MAX_COST_USD = 0.1;

/**
 * Evaluation Service implementation.
 *
 * Orchestrates the evaluation lifecycle, computing quality metrics
 * for executions and persisting results for downstream intelligence.
 */
export class EvaluationService implements IEvaluationService {
  private readonly executionRepository: IExecutionRepository;
  private readonly evaluationRepository: IEvaluationRepository;
  private readonly eventStore: EventStore;
  private readonly logger: Logger;
  private readonly llmProvider?: LLMProvider;

  constructor(
    executionRepository: IExecutionRepository,
    evaluationRepository: IEvaluationRepository,
    eventStore: EventStore,
    logger: Logger,
    llmProvider?: LLMProvider
  ) {
    this.executionRepository = executionRepository;
    this.evaluationRepository = evaluationRepository;
    this.eventStore = eventStore;
    this.logger = logger;
    this.llmProvider = llmProvider;
  }

  async evaluateExecution(executionId: ExecutionId): Promise<Result<Evaluation>> {
    try {
      const execution = await this.executionRepository.findByIdempotent(executionId);
      if (!execution) {
        return err(notFoundError("Execution", executionId));
      }

      const metrics = await this.computeMetrics(execution);

      const evaluationId = crypto.randomUUID() as EvaluationId;
      const summary = this.generateSummary(metrics);

      const evaluation: Evaluation = {
        evaluation_id: evaluationId,
        execution_id: executionId,
        organization_id: execution.organization_id,
        project_id: execution.project_id,
        scores: [
          { dimension: "accuracy", score: metrics.accuracy, confidence: metrics.confidence },
          { dimension: "cost_efficiency", score: metrics.cost_efficiency, confidence: 0.8 },
          { dimension: "latency", score: metrics.latency_score, confidence: 0.9 },
          { dimension: "safety", score: metrics.safety_score, confidence: 0.7 },
        ],
        overall_score: this.computeOverallScore(metrics),
        evaluation_model_version: this.llmProvider?.name ?? "rule-based-1.0",
        summary,
        source: "automated",
        created_at: new Date().toISOString(),
      };

      await this.evaluationRepository.create(evaluation);

      const event: DomainEvent = {
        event_id: createEventId(),
        event_type: "evaluation.generated",
        execution_id: executionId,
        organization_id: execution.organization_id,
        project_id: execution.project_id,
        timestamp: new Date().toISOString(),
        schema_version: CURRENT_SCHEMA_VERSION,
        producer: "evaluation-service",
        payload: {
          evaluation_id: evaluationId,
          metrics,
          summary,
        },
        metadata: {},
      };

      await this.eventStore.append(event);

      this.logger.info("Evaluation generated", {
        evaluationId,
        executionId,
        overallScore: this.computeOverallScore(metrics),
      });

      return ok(evaluation);
    } catch (error) {
      this.logger.error("Failed to evaluate execution", error instanceof Error ? error : undefined, {
        executionId,
      });
      return err(internalError(
        "Failed to evaluate execution",
        error instanceof Error ? { cause: error.message } : undefined,
      ));
    }
  }

  async getEvaluation(id: string): Promise<Result<Evaluation>> {
    const validation = EvaluationIdSchema.safeParse(id);
    if (!validation.success) {
      return err(validationError("Invalid evaluation ID"));
    }

    try {
      const evaluation = await this.evaluationRepository.findById(id);
      if (!evaluation) {
        return err(notFoundError("Evaluation", id));
      }
      return ok(evaluation);
    } catch (error) {
      this.logger.error("Failed to get evaluation", error instanceof Error ? error : undefined, {
        evaluationId: id,
      });
      return err(internalError(
        "Failed to retrieve evaluation",
        error instanceof Error ? { cause: error.message } : undefined,
      ));
    }
  }

  async listByExecution(executionId: ExecutionId): Promise<Result<Evaluation[]>> {
    try {
      const evaluations = await this.evaluationRepository.findByExecutionId(executionId);
      return ok(evaluations);
    } catch (error) {
      this.logger.error("Failed to list evaluations by execution", error instanceof Error ? error : undefined, {
        executionId,
      });
      return err(internalError(
        "Failed to list evaluations",
        error instanceof Error ? { cause: error.message } : undefined,
      ));
    }
  }

  async listByProject(
    projectId: ProjectId,
    options: PaginationOptions
  ): Promise<Result<PaginatedResult<Evaluation>>> {
    try {
      const result = await this.evaluationRepository.listByProject(projectId, options);
      return ok(result);
    } catch (error) {
      this.logger.error("Failed to list evaluations by project", error instanceof Error ? error : undefined, {
        projectId,
      });
      return err(internalError(
        "Failed to list evaluations",
        error instanceof Error ? { cause: error.message } : undefined,
      ));
    }
  }

  async compare(evaluationIds: string[]): Promise<Result<ComparisonResult>> {
    const validation = ComparisonSchema.safeParse({ evaluationIds });
    if (!validation.success) {
      return err(validationError(
        `Invalid comparison input: ${validation.error.issues.map((i) => i.message).join(", ")}`,
      ));
    }

    try {
      const evaluations: Evaluation[] = [];
      for (const id of validation.data.evaluationIds) {
        const evaluation = await this.evaluationRepository.findById(id);
        if (!evaluation) {
          return err(notFoundError("Evaluation", id));
        }
        evaluations.push(evaluation);
      }

      const averages = this.computeAverages(evaluations);
      const scored = evaluations.map((e) => ({
        evaluation_id: e.evaluation_id,
        score: e.overall_score,
      }));

      scored.sort((a, b) => b.score - a.score);

      const result: ComparisonResult = {
        evaluations: Object.freeze(evaluations),
        averages,
        best: {
          evaluation_id: scored[0]!.evaluation_id,
          score: scored[0]!.score,
        },
        worst: {
          evaluation_id: scored[scored.length - 1]!.evaluation_id,
          score: scored[scored.length - 1]!.score,
        },
      };

      return ok(result);
    } catch (error) {
      this.logger.error("Failed to compare evaluations", error instanceof Error ? error : undefined, {
        evaluationIds,
      });
      return err(internalError(
        "Failed to compare evaluations",
        error instanceof Error ? { cause: error.message } : undefined,
      ));
    }
  }

  /**
   * Computes evaluation metrics for an execution.
   *
   * Uses a combination of rule-based analysis and optional LLM analysis
   * to produce quality scores across all dimensions.
   */
  private async computeMetrics(execution: Execution): Promise<EvaluationMetrics> {
    const latencyScore = this.computeLatencyScore(execution.latency_ms);
    const costEfficiency = this.computeCostEfficiency(execution.estimated_cost, execution.total_tokens);

    let accuracy = 0.5;
    let goalCompletion = 0.5;
    let hallucinationScore = 0.5;
    let confidence = 0.5;
    let safetyScore = 0.7;

    if (this.llmProvider && execution.metadata) {
      try {
        const analysis = await this.analyzeWithLLM(execution);
        accuracy = analysis.accuracy;
        goalCompletion = analysis.goal_completion;
        hallucinationScore = analysis.hallucination_score;
        confidence = analysis.confidence;
        safetyScore = analysis.safety_score;
      } catch {
        this.logger.warn("LLM analysis failed, using defaults", {
          executionId: execution.execution_id,
        });
      }
    } else {
      accuracy = this.estimateAccuracy(execution);
      goalCompletion = this.estimateGoalCompletion(execution);
      confidence = this.estimateConfidence(execution);
    }

    return {
      accuracy: this.clamp(accuracy),
      goal_completion: this.clamp(goalCompletion),
      hallucination_score: this.clamp(hallucinationScore),
      confidence: this.clamp(confidence),
      cost_efficiency: this.clamp(costEfficiency),
      latency_score: this.clamp(latencyScore),
      safety_score: this.clamp(safetyScore),
    };
  }

  /**
   * Analyzes execution content using the LLM provider.
   */
  private async analyzeWithLLM(execution: Execution): Promise<{
    accuracy: number;
    goal_completion: number;
    hallucination_score: number;
    confidence: number;
    safety_score: number;
  }> {
    if (!this.llmProvider) {
      throw new Error("No LLM provider configured");
    }

    const inputJson = JSON.stringify(execution.metadata?.inputParameters ?? {}, null, 2);
    const outputJson = JSON.stringify(execution.metadata?.providerMetadata ?? {}, null, 2);

    const prompt = `Analyze this AI execution and provide scores for each metric.
Input: ${inputJson}
Output: ${outputJson}
Model: ${execution.model}
Provider: ${execution.provider}

Respond with JSON only:
{
  "accuracy": <0-1>,
  "goal_completion": <0-1>,
  "hallucination_score": <0-1>,
  "confidence": <0-1>,
  "safety_score": <0-1>
}`;

    const response = await this.llmProvider.complete(prompt);
    const parsed = JSON.parse(response) as Record<string, unknown>;

    return {
      accuracy: typeof parsed.accuracy === "number" ? parsed.accuracy : 0.5,
      goal_completion: typeof parsed.goal_completion === "number" ? parsed.goal_completion : 0.5,
      hallucination_score: typeof parsed.hallucination_score === "number" ? parsed.hallucination_score : 0.5,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      safety_score: typeof parsed.safety_score === "number" ? parsed.safety_score : 0.7,
    };
  }

  /**
   * Estimates accuracy based on execution status and tokens.
   */
  private estimateAccuracy(execution: Execution): number {
    if (execution.status === "completed") return 0.7;
    if (execution.status === "failed") return 0.2;
    if (execution.output_tokens > 0) return 0.6;
    return 0.5;
  }

  /**
   * Estimates goal completion based on execution outcome.
   */
  private estimateGoalCompletion(execution: Execution): number {
    if (execution.status === "completed") return 0.8;
    if (execution.status === "failed") return 0.1;
    return 0.5;
  }

  /**
   * Estimates confidence based on token usage patterns.
   */
  private estimateConfidence(execution: Execution): number {
    if (execution.total_tokens === 0) return 0.3;
    const ratio = execution.output_tokens / Math.max(execution.total_tokens, 1);
    if (ratio > 0.3 && ratio < 0.8) return 0.7;
    return 0.5;
  }

  /**
   * Computes latency score relative to expected latency.
   */
  private computeLatencyScore(latencyMs: number | null): number {
    if (latencyMs === null) return 0.5;
    if (latencyMs <= 0) return 1.0;
    const ratio = DEFAULT_EXPECTED_LATENCY_MS / latencyMs;
    return Math.min(1, ratio);
  }

  /**
   * Computes cost efficiency based on cost and token usage.
   */
  private computeCostEfficiency(estimatedCost: number, totalTokens: number): number {
    if (totalTokens === 0) return 0.5;
    if (estimatedCost <= 0) return 1.0;
    const costRatio = estimatedCost / DEFAULT_MAX_COST_USD;
    return Math.max(0, 1 - costRatio);
  }

  /**
   * Computes a single overall score from all metrics.
   */
  private computeOverallScore(metrics: EvaluationMetrics): number {
    const weights = {
      accuracy: 0.25,
      goal_completion: 0.25,
      hallucination_score: 0.15,
      confidence: 0.1,
      cost_efficiency: 0.1,
      latency_score: 0.1,
      safety_score: 0.05,
    };

    return (
      metrics.accuracy * weights.accuracy +
      metrics.goal_completion * weights.goal_completion +
      (1 - metrics.hallucination_score) * weights.hallucination_score +
      metrics.confidence * weights.confidence +
      metrics.cost_efficiency * weights.cost_efficiency +
      metrics.latency_score * weights.latency_score +
      metrics.safety_score * weights.safety_score
    );
  }

  /**
   * Computes average metrics across multiple evaluations.
   */
  private computeAverages(evaluations: readonly Evaluation[]): EvaluationMetrics {
    const count = evaluations.length;
    if (count === 0) {
      return {
        accuracy: 0,
        goal_completion: 0,
        hallucination_score: 0,
        confidence: 0,
        cost_efficiency: 0,
        latency_score: 0,
        safety_score: 0,
      };
    }

    const getScore = (e: Evaluation, dimension: string): number => {
      const score = e.scores.find((s) => s.dimension === dimension);
      return score?.score ?? 0;
    };

    const sum = evaluations.reduce(
      (acc, e) => ({
        accuracy: acc.accuracy + getScore(e, "accuracy"),
        goal_completion: acc.goal_completion + (e.overall_score),
        hallucination_score: acc.hallucination_score,
        confidence: acc.confidence,
        cost_efficiency: acc.cost_efficiency + getScore(e, "cost_efficiency"),
        latency_score: acc.latency_score + getScore(e, "latency"),
        safety_score: acc.safety_score + getScore(e, "safety"),
      }),
      {
        accuracy: 0,
        goal_completion: 0,
        hallucination_score: 0,
        confidence: 0,
        cost_efficiency: 0,
        latency_score: 0,
        safety_score: 0,
      }
    );

    return {
      accuracy: sum.accuracy / count,
      goal_completion: sum.goal_completion / count,
      hallucination_score: sum.hallucination_score / count,
      confidence: sum.confidence / count,
      cost_efficiency: sum.cost_efficiency / count,
      latency_score: sum.latency_score / count,
      safety_score: sum.safety_score / count,
    };
  }

  /**
   * Generates a human-readable summary from metrics.
   */
  private generateSummary(metrics: EvaluationMetrics): string {
    const overall = this.computeOverallScore(metrics);
    if (overall >= 0.8) return "High quality execution with excellent metrics across all dimensions.";
    if (overall >= 0.6) return "Good execution with acceptable quality metrics.";
    if (overall >= 0.4) return "Average execution with some areas for improvement.";
    return "Below average execution requiring attention.";
  }

  /**
   * Clamps a value to the [0, 1] range.
   */
  private clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}

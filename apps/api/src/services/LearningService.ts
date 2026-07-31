/**
 * Learning Service — detects patterns and insights from execution history.
 *
 * Responsible for analyzing executions, identifying recurring patterns,
 * detecting anomalies, and generating learning records. Learning builds
 * on top of the knowledge graph to provide actionable insights.
 */

import type { LearningRepository } from "../repositories/LearningRepository";
import type { LLMProvider } from "./LLMProvider";

/**
 * Service interface for learning operations.
 */
export interface ILearningService {
  detectPatterns(projectId: string, organizationId: string): Promise<readonly Record<string, unknown>[]>;
  getPatternsByProject(projectId: string, options: { cursor?: string; limit: number; pattern_type?: string; severity?: string }): Promise<{ items: readonly Record<string, unknown>[]; next_cursor: string | null; has_more: boolean }>;
  getPatternById(id: string): Promise<Record<string, unknown> | null>;
}

/**
 * Learning Service implementation.
 *
 * Orchestrates pattern detection and learning, using LLM analysis
 * to identify recurring patterns, anomalies, and optimization opportunities.
 */
export class LearningService implements ILearningService {
  constructor(
    private readonly repo: LearningRepository,
    private readonly llm: LLMProvider
  ) {}

  async detectPatterns(projectId: string, organizationId: string): Promise<readonly Record<string, unknown>[]> {
    const response = await this.llm.generate({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "Analyze these AI executions and detect recurring patterns. Return a JSON array of objects with 'pattern_type' (one of: repeated_failure, success_pattern, prompt_regression, model_routing, tool_effectiveness, cost_optimization), 'pattern' (description), 'frequency', 'severity' (low/medium/high/critical), and 'suggestion' fields." },
        { role: "user", content: `Project ID: ${projectId}. Analyze recent executions for patterns.` },
      ],
      response_format: { type: "json_object" },
    });

    const patterns = JSON.parse(response.content) as Array<{
      pattern_type: string; pattern: string; frequency: number;
      severity: string; suggestion: string;
    }>;

    const created: Record<string, unknown>[] = [];
    for (const p of patterns) {
      const id = crypto.randomUUID();
      await this.repo.create({
        id,
        execution_id: "",
        project_id: projectId,
        pattern_type: p.pattern_type,
        pattern: p.pattern,
        frequency: p.frequency,
        severity: p.severity,
        suggestion: p.suggestion,
        evidence: { detected_at: new Date().toISOString() },
      });
      created.push({ id, ...p });
    }
    return created;
  }

  async getPatternsByProject(projectId: string, options: { cursor?: string; limit: number; pattern_type?: string; severity?: string }) {
    return this.repo.listByProject({ project_id: projectId, ...options });
  }

  async getPatternById(id: string) {
    return this.repo.findById(id);
  }
}

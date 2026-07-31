import type { RecommendationRepository } from "../repositories/RecommendationRepository";
import type { LLMProvider } from "./LLMProvider";

interface IRecommendationService {
  generateRecommendations(executionId: string, projectId: string, organizationId: string): Promise<readonly Record<string, unknown>[]>;
  getRecommendation(id: string): Promise<Record<string, unknown> | null>;
  listByProject(projectId: string, options: { cursor?: string; limit: number; status?: string; priority?: string }): Promise<{ items: readonly Record<string, unknown>[]; next_cursor: string | null; has_more: boolean }>;
  applyRecommendation(id: string): Promise<Record<string, unknown>>;
}

export class RecommendationService implements IRecommendationService {
  constructor(
    private readonly repo: RecommendationRepository,
    private readonly llm: LLMProvider
  ) {}

  async generateRecommendations(executionId: string, projectId: string, organizationId: string): Promise<readonly Record<string, unknown>[]> {
    const response = await this.llm.generate({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "Based on this AI execution, generate optimization recommendations. Return a JSON array of objects with 'title', 'description', 'recommendation_type' (one of: model_switch, prompt_optimization, tool_change, workflow_restructure, cost_reduction, latency_improvement), 'confidence' (0-1), 'priority' (low/medium/high/critical), and 'expected_impact' (object with description and estimated_improvement fields)." },
        { role: "user", content: `Execution ID: ${executionId}, Project ID: ${projectId}` },
      ],
      response_format: { type: "json_object" },
    });

    const recs = JSON.parse(response.content) as Array<{
      title: string; description: string; recommendation_type: string;
      confidence: number; priority: string; expected_impact: Record<string, unknown>;
    }>;

    const created: Record<string, unknown>[] = [];
    for (const rec of recs) {
      const id = crypto.randomUUID();
      await this.repo.create({
        id,
        execution_id: executionId,
        project_id: projectId,
        recommendation_type: rec.recommendation_type,
        title: rec.title,
        description: rec.description,
        confidence: rec.confidence,
        priority: rec.priority,
        status: "pending",
        evidence: { execution_id: executionId },
        expected_impact: rec.expected_impact,
      });
      created.push({ id, ...rec });
    }
    return created;
  }

  async getRecommendation(id: string) { return this.repo.findById(id); }

  async listByProject(projectId: string, options: { cursor?: string; limit: number; status?: string; priority?: string }) {
    return this.repo.listByProject(projectId, options);
  }

  async applyRecommendation(id: string) {
    await this.repo.updateStatus(id, "applied");
    return { id, status: "applied", applied_at: new Date().toISOString() };
  }
}

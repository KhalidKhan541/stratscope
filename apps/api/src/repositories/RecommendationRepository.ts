export interface RecommendationRepository {
  create(params: {
    readonly id: string;
    readonly execution_id: string;
    readonly project_id: string;
    readonly recommendation_type: string;
    readonly title: string;
    readonly description: string;
    readonly confidence: number;
    readonly priority: string;
    readonly status: string;
    readonly evidence: Record<string, unknown>;
    readonly expected_impact: Record<string, unknown>;
  }): Promise<void>;
  findById(id: string): Promise<Record<string, unknown> | null>;
  listByProject(projectId: string, options: { cursor?: string; limit: number; status?: string; priority?: string }): Promise<{ items: readonly Record<string, unknown>[]; next_cursor: string | null; has_more: boolean }>;
  updateStatus(id: string, status: string): Promise<void>;
  countByProject(projectId: string): Promise<number>;
}

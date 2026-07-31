import type { D1Database } from "@cloudflare/workers-types";
import type { ResearchAgent, ResearchAgentType } from "@stratscope/core/src/domain/research/ResearchAgent";

interface ResearchAgentRow {
  readonly id: string;
  readonly organization_id: string;
  readonly project_id: string;
  readonly name: string;
  readonly description: string;
  readonly agent_type: string;
  readonly status: string;
  readonly config: string;
  readonly capabilities: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}

export class ResearchAgentRepository {
  private readonly db: D1Database;
  private readonly tableName = "research_agents";

  constructor(db: D1Database) {
    this.db = db;
  }

  async create(agent: ResearchAgent): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO ${this.tableName} (
          id,
          organization_id,
          project_id,
          name,
          description,
          agent_type,
          status,
          config,
          capabilities,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        agent.id,
        agent.organization_id,
        agent.project_id,
        agent.name,
        agent.description,
        agent.agent_type,
        agent.status,
        JSON.stringify(agent.config),
        JSON.stringify(agent.capabilities),
        agent.created_at,
        agent.updated_at
      )
      .run();
  }

  async findById(id: string): Promise<ResearchAgent | null> {
    const result = await this.db
      .prepare(
        `SELECT * FROM ${this.tableName} WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(id)
      .first<ResearchAgentRow>();
    return result ? this.rowToResearchAgent(result) : null;
  }

  async findByOrganizationId(orgId: string): Promise<ResearchAgent[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM ${this.tableName} WHERE organization_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`
      )
      .bind(orgId)
      .all<ResearchAgentRow>();
    return (result.results ?? []).map((row) => this.rowToResearchAgent(row));
  }

  async findByProjectId(projectId: string): Promise<ResearchAgent[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM ${this.tableName} WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`
      )
      .bind(projectId)
      .all<ResearchAgentRow>();
    return (result.results ?? []).map((row) => this.rowToResearchAgent(row));
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE ${this.tableName} SET status = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(status, new Date().toISOString(), id)
      .run();
  }

  async delete(id: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE ${this.tableName} SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(new Date().toISOString(), id)
      .run();
  }

  private rowToResearchAgent(row: ResearchAgentRow): ResearchAgent {
    return {
      id: row.id,
      organization_id: row.organization_id,
      project_id: row.project_id,
      name: row.name,
      description: row.description,
      agent_type: row.agent_type as ResearchAgentType,
      status: row.status as ResearchAgent["status"],
      config: JSON.parse(row.config ?? "{}"),
      capabilities: JSON.parse(row.capabilities ?? "[]"),
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at ?? null,
    };
  }
}

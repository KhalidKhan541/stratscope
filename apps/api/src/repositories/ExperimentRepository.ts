import type { D1Database } from "@cloudflare/workers-types";
import type { Experiment, ExperimentConfig, ExperimentResult } from "@stratscope/core/src/domain/experiment/Experiment";

interface ExperimentRow {
  readonly id: string;
  readonly organization_id: string;
  readonly project_id: string;
  readonly name: string;
  readonly description: string;
  readonly status: string;
  readonly config: string;
  readonly results: string;
  readonly dataset_id: string | null;
  readonly benchmark_id: string | null;
  readonly created_at: string;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  readonly deleted_at: string | null;
}

export interface IExperimentRepository {
  create(experiment: Experiment): Promise<void>;
  findById(id: string): Promise<Experiment | null>;
  findByOrganizationId(orgId: string): Promise<Experiment[]>;
  findByProjectId(projectId: string): Promise<Experiment[]>;
  updateStatus(id: string, status: string): Promise<void>;
  updateResults(id: string, results: ExperimentResult[]): Promise<void>;
  delete(id: string): Promise<void>;
}

export class D1ExperimentRepository implements IExperimentRepository {
  constructor(private readonly db: D1Database) {}

  async create(experiment: Experiment): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO experiments (id, organization_id, project_id, name, description, status, config, results, dataset_id, benchmark_id, created_at, started_at, completed_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        experiment.experiment_id,
        experiment.organization_id,
        experiment.project_id,
        experiment.name,
        experiment.description,
        experiment.status,
        JSON.stringify(experiment.config),
        JSON.stringify(experiment.results),
        experiment.dataset_id ?? null,
        experiment.benchmark_id ?? null,
        experiment.created_at,
        experiment.started_at ?? null,
        experiment.completed_at ?? null,
        null
      )
      .run();
  }

  async findById(id: string): Promise<Experiment | null> {
    const row = await this.db
      .prepare(`SELECT * FROM experiments WHERE id = ? AND deleted_at IS NULL`)
      .bind(id)
      .first<ExperimentRow>();
    return row ? this.rowToExperiment(row) : null;
  }

  async findByOrganizationId(orgId: string): Promise<Experiment[]> {
    const result = await this.db
      .prepare(`SELECT * FROM experiments WHERE organization_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`)
      .bind(orgId)
      .all<ExperimentRow>();
    return result.results.map((row) => this.rowToExperiment(row));
  }

  async findByProjectId(projectId: string): Promise<Experiment[]> {
    const result = await this.db
      .prepare(`SELECT * FROM experiments WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`)
      .bind(projectId)
      .all<ExperimentRow>();
    return result.results.map((row) => this.rowToExperiment(row));
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.db
      .prepare(`UPDATE experiments SET status = ? WHERE id = ?`)
      .bind(status, id)
      .run();
  }

  async updateResults(id: string, results: ExperimentResult[]): Promise<void> {
    await this.db
      .prepare(`UPDATE experiments SET results = ? WHERE id = ?`)
      .bind(JSON.stringify(results), id)
      .run();
  }

  async delete(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(`UPDATE experiments SET deleted_at = ? WHERE id = ?`)
      .bind(now, id)
      .run();
  }

  private rowToExperiment(row: ExperimentRow): Experiment {
    let config: ExperimentConfig;
    try {
      config = JSON.parse(row.config) as ExperimentConfig;
    } catch {
      config = { hypothesis: "", variables: [], sample_size: 0, metrics: [] };
    }

    let results: ExperimentResult[];
    try {
      results = JSON.parse(row.results) as ExperimentResult[];
    } catch {
      results = [];
    }

    return {
      experiment_id: row.id,
      organization_id: row.organization_id,
      project_id: row.project_id,
      name: row.name,
      description: row.description,
      status: row.status as Experiment["status"],
      config,
      results,
      dataset_id: row.dataset_id ?? undefined,
      benchmark_id: row.benchmark_id ?? undefined,
      created_at: row.created_at,
      started_at: row.started_at ?? undefined,
      completed_at: row.completed_at ?? undefined,
    };
  }
}

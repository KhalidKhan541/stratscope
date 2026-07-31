import type { D1Database } from "@cloudflare/workers-types";

export interface SyntheticDataset {
  readonly id: string;
  readonly organization_id: string;
  readonly project_id: string;
  readonly name: string;
  readonly source_model: string;
  readonly record_count: number;
  readonly schema_definition: Record<string, unknown>;
  readonly generation_config: Record<string, unknown>;
  readonly status: string;
  readonly created_at: string;
}

interface SyntheticDatasetRow {
  readonly id: string;
  readonly organization_id: string;
  readonly project_id: string;
  readonly name: string;
  readonly source_model: string;
  readonly record_count: number;
  readonly schema_definition: string;
  readonly generation_config: string;
  readonly status: string;
  readonly created_at: string;
}

export class SyntheticDatasetRepository {
  private readonly db: D1Database;
  private readonly tableName = "synthetic_datasets";

  constructor(db: D1Database) {
    this.db = db;
  }

  async create(dataset: SyntheticDataset): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO ${this.tableName} (
          id,
          organization_id,
          project_id,
          name,
          source_model,
          record_count,
          schema_definition,
          generation_config,
          status,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        dataset.id,
        dataset.organization_id,
        dataset.project_id,
        dataset.name,
        dataset.source_model,
        dataset.record_count,
        JSON.stringify(dataset.schema_definition),
        JSON.stringify(dataset.generation_config),
        dataset.status,
        dataset.created_at
      )
      .run();
  }

  async findById(id: string): Promise<SyntheticDataset | null> {
    const result = await this.db
      .prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`)
      .bind(id)
      .first<SyntheticDatasetRow>();
    return result ? this.rowToSyntheticDataset(result) : null;
  }

  async findByOrganizationId(orgId: string): Promise<SyntheticDataset[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM ${this.tableName} WHERE organization_id = ? ORDER BY created_at DESC`
      )
      .bind(orgId)
      .all<SyntheticDatasetRow>();
    return (result.results ?? []).map((row) => this.rowToSyntheticDataset(row));
  }

  async updateRecordCount(id: string, recordCount: number): Promise<void> {
    await this.db
      .prepare(
        `UPDATE ${this.tableName} SET record_count = ? WHERE id = ?`
      )
      .bind(recordCount, id)
      .run();
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE ${this.tableName} SET status = ? WHERE id = ?`
      )
      .bind(status, id)
      .run();
  }

  private rowToSyntheticDataset(row: SyntheticDatasetRow): SyntheticDataset {
    return {
      id: row.id,
      organization_id: row.organization_id,
      project_id: row.project_id,
      name: row.name,
      source_model: row.source_model,
      record_count: row.record_count,
      schema_definition: JSON.parse(row.schema_definition ?? "{}"),
      generation_config: JSON.parse(row.generation_config ?? "{}"),
      status: row.status,
      created_at: row.created_at,
    };
  }
}

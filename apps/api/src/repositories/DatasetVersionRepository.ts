import type { D1Database } from "@cloudflare/workers-types";

export interface DatasetVersion {
  readonly id: string;
  readonly dataset_id: string;
  readonly organization_id: string;
  readonly version: number;
  readonly status: string;
  readonly record_count: number;
  readonly schema_definition: Record<string, unknown>;
  readonly filters: Record<string, unknown>;
  readonly checksum: string | null;
  readonly storage_path: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

interface DatasetVersionRow {
  readonly id: string;
  readonly dataset_id: string;
  readonly organization_id: string;
  readonly version: number;
  readonly status: string;
  readonly record_count: number;
  readonly schema_definition: string;
  readonly filters: string;
  readonly checksum: string | null;
  readonly storage_path: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface IDatasetVersionRepository {
  create(version: DatasetVersion): Promise<void>;
  findById(id: string): Promise<DatasetVersion | null>;
  findByDatasetId(datasetId: string): Promise<readonly DatasetVersion[]>;
  findLatestByDatasetId(datasetId: string): Promise<DatasetVersion | null>;
  updateStatus(id: string, status: string): Promise<void>;
}

export class D1DatasetVersionRepository implements IDatasetVersionRepository {
  private readonly db: D1Database;
  private readonly tableName: string;

  constructor(db: D1Database, tableName: string = "dataset_versions") {
    this.db = db;
    this.tableName = tableName;
  }

  async create(version: DatasetVersion): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO ${this.tableName} (
          id,
          dataset_id,
          organization_id,
          version,
          status,
          record_count,
          schema_definition,
          filters,
          checksum,
          storage_path,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        version.id,
        version.dataset_id,
        version.organization_id,
        version.version,
        version.status,
        version.record_count,
        JSON.stringify(version.schema_definition),
        JSON.stringify(version.filters),
        version.checksum,
        version.storage_path,
        version.created_at,
        version.updated_at
      )
      .run();
  }

  async findById(id: string): Promise<DatasetVersion | null> {
    const result = await this.db
      .prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`)
      .bind(id)
      .first<DatasetVersionRow>();

    return result ? this.rowToDatasetVersion(result) : null;
  }

  async findByDatasetId(datasetId: string): Promise<readonly DatasetVersion[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM ${this.tableName}
         WHERE dataset_id = ?
         ORDER BY version DESC`
      )
      .bind(datasetId)
      .all<DatasetVersionRow>();

    return Object.freeze(result.results.map((row) => this.rowToDatasetVersion(row)));
  }

  async findLatestByDatasetId(datasetId: string): Promise<DatasetVersion | null> {
    const result = await this.db
      .prepare(
        `SELECT * FROM ${this.tableName}
         WHERE dataset_id = ?
         ORDER BY version DESC
         LIMIT 1`
      )
      .bind(datasetId)
      .first<DatasetVersionRow>();

    return result ? this.rowToDatasetVersion(result) : null;
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE ${this.tableName}
         SET status = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(status, new Date().toISOString(), id)
      .run();
  }

  private rowToDatasetVersion(row: DatasetVersionRow): DatasetVersion {
    return {
      id: row.id,
      dataset_id: row.dataset_id,
      organization_id: row.organization_id,
      version: row.version,
      status: row.status,
      record_count: row.record_count,
      schema_definition: JSON.parse(row.schema_definition) as Record<string, unknown>,
      filters: JSON.parse(row.filters) as Record<string, unknown>,
      checksum: row.checksum,
      storage_path: row.storage_path,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

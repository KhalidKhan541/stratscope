import type { D1Database } from "@cloudflare/workers-types";

export interface ResearchExport {
  readonly id: string;
  readonly organization_id: string;
  readonly dataset_id: string | undefined;
  readonly benchmark_id: string | undefined;
  readonly format: string;
  readonly record_count: number;
  readonly file_size_bytes: number;
  readonly storage_path: string | undefined;
  readonly status: string;
  readonly created_at: string;
  readonly completed_at: string | undefined;
}

interface ResearchExportRow {
  readonly id: string;
  readonly organization_id: string;
  readonly dataset_id: string | null;
  readonly benchmark_id: string | null;
  readonly format: string;
  readonly record_count: number;
  readonly file_size_bytes: number;
  readonly storage_path: string | null;
  readonly status: string;
  readonly created_at: string;
  readonly completed_at: string | null;
}

export interface IResearchExportRepository {
  create(exportRecord: ResearchExport): Promise<void>;
  findById(id: string): Promise<ResearchExport | null>;
  findByOrganizationId(orgId: string): Promise<ResearchExport[]>;
  updateStatus(id: string, status: string, storagePath?: string): Promise<void>;
}

export class D1ResearchExportRepository implements IResearchExportRepository {
  constructor(private readonly db: D1Database) {}

  async create(exportRecord: ResearchExport): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO research_exports (id, organization_id, dataset_id, benchmark_id, format, record_count, file_size_bytes, storage_path, status, created_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        exportRecord.id,
        exportRecord.organization_id,
        exportRecord.dataset_id ?? null,
        exportRecord.benchmark_id ?? null,
        exportRecord.format,
        exportRecord.record_count,
        exportRecord.file_size_bytes,
        exportRecord.storage_path ?? null,
        exportRecord.status,
        exportRecord.created_at,
        exportRecord.completed_at ?? null
      )
      .run();
  }

  async findById(id: string): Promise<ResearchExport | null> {
    const row = await this.db
      .prepare(`SELECT * FROM research_exports WHERE id = ?`)
      .bind(id)
      .first<ResearchExportRow>();
    return row ? this.rowToExport(row) : null;
  }

  async findByOrganizationId(orgId: string): Promise<ResearchExport[]> {
    const result = await this.db
      .prepare(`SELECT * FROM research_exports WHERE organization_id = ? ORDER BY created_at DESC`)
      .bind(orgId)
      .all<ResearchExportRow>();
    return result.results.map((row) => this.rowToExport(row));
  }

  async updateStatus(id: string, status: string, storagePath?: string): Promise<void> {
    if (storagePath !== undefined) {
      await this.db
        .prepare(`UPDATE research_exports SET status = ?, storage_path = ? WHERE id = ?`)
        .bind(status, storagePath, id)
        .run();
    } else {
      await this.db
        .prepare(`UPDATE research_exports SET status = ? WHERE id = ?`)
        .bind(status, id)
        .run();
    }
  }

  private rowToExport(row: ResearchExportRow): ResearchExport {
    return {
      id: row.id,
      organization_id: row.organization_id,
      dataset_id: row.dataset_id ?? undefined,
      benchmark_id: row.benchmark_id ?? undefined,
      format: row.format,
      record_count: row.record_count,
      file_size_bytes: row.file_size_bytes,
      storage_path: row.storage_path ?? undefined,
      status: row.status,
      created_at: row.created_at,
      completed_at: row.completed_at ?? undefined,
    };
  }
}

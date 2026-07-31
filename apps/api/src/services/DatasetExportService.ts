import type { OrganizationId } from "@stratscope/core";
import type { ExportFormat } from "@stratscope/core";

/**
 * Represents an export job for a dataset.
 */
interface ExportJob {
  /** Unique export job identifier. */
  readonly id: string;
  /** The dataset being exported. */
  readonly dataset_id: string;
  /** The export format. */
  readonly format: ExportFormat;
  /** Current job status. */
  readonly status: "pending" | "processing" | "completed" | "failed";
  /** R2 storage path of the exported file. */
  readonly storage_path: string | null;
  /** File size in bytes. */
  readonly file_size_bytes: number | null;
  /** Number of records exported. */
  readonly record_count: number | null;
  /** Error message if the job failed. */
  readonly error: string | null;
  /** Job creation timestamp. */
  readonly created_at: string;
  /** Job completion timestamp. */
  readonly completed_at: string | null;
}

/**
 * Contract for the dataset export service.
 */
interface IDatasetExportService {
  /**
   * Export a dataset in the specified format.
   *
   * @param datasetId - The dataset to export.
   * @param format - The target export format.
   * @param organizationId - The organization scope for access control.
   * @returns The export job with storage location.
   */
  exportDataset(
    datasetId: string,
    format: ExportFormat,
    organizationId: OrganizationId
  ): Promise<ExportJob>;

  /**
   * Retrieve an export job by ID.
   *
   * @param id - The export job ID.
   * @returns The export job, or null if not found.
   */
  getExport(id: string): Promise<ExportJob | null>;

  /**
   * List all export jobs for a dataset.
   *
   * @param datasetId - The dataset ID.
   * @returns List of export jobs ordered by creation date.
   */
  listExportsByDataset(datasetId: string): Promise<readonly ExportJob[]>;
}

/**
 * Service for exporting datasets in multiple formats.
 *
 * Supports JSONL, CSV, Parquet (as JSON fallback), Arrow (as JSON fallback),
 * and REST API format. Exports are stored in R2 object storage.
 */
export class DatasetExportService implements IDatasetExportService {
  /**
   * Create a new DatasetExportService.
   *
   * @param db - Cloudflare D1 database binding.
   * @param bucket - Cloudflare R2 bucket binding.
   */
  constructor(
    private readonly db: D1Database,
    private readonly bucket: R2Bucket
  ) {}

  /** {@inheritDoc IDatasetExportService.exportDataset} */
  async exportDataset(
    datasetId: string,
    format: ExportFormat,
    organizationId: OrganizationId
  ): Promise<ExportJob> {
    const exportId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Fetch dataset records
    const dataset = await this.db
      .prepare(
        `SELECT * FROM datasets WHERE id = ? AND organization_id = ?`
      )
      .bind(datasetId, organizationId)
      .first();

    if (!dataset) throw new Error("Dataset not found");

    // Fetch related executions
    const executions = await this.db
      .prepare(
        `SELECT * FROM executions WHERE project_id = ? AND status = 'completed'`
      )
      .bind(dataset.project_id)
      .all();

    const records = executions.results ?? [];
    let content: string;
    let contentType: string;
    let extension: string;

    switch (format) {
      case "jsonl":
        content = records.map((r) => JSON.stringify(r)).join("\n");
        contentType = "application/jsonl";
        extension = "jsonl";
        break;
      case "csv":
        content = this.toCsv(records);
        contentType = "text/csv";
        extension = "csv";
        break;
      case "parquet":
        // For MVP, export as JSON array (parquet requires a library)
        content = JSON.stringify(records, null, 2);
        contentType = "application/json";
        extension = "json";
        break;
      case "arrow":
        content = JSON.stringify(records, null, 2);
        contentType = "application/json";
        extension = "json";
        break;
      case "rest":
        content = JSON.stringify(
          { dataset_id: datasetId, records },
          null,
          2
        );
        contentType = "application/json";
        extension = "json";
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    const storagePath = `exports/${datasetId}/${exportId}.${extension}`;
    await this.bucket.put(storagePath, content, {
      httpMetadata: { contentType },
    });

    const job: ExportJob = {
      id: exportId,
      dataset_id: datasetId,
      format,
      status: "completed",
      storage_path: storagePath,
      file_size_bytes: new TextEncoder().encode(content).length,
      record_count: records.length,
      error: null,
      created_at: now,
      completed_at: new Date().toISOString(),
    };

    await this.db
      .prepare(
        `INSERT INTO dataset_exports (id, dataset_id, organization_id, format, status, storage_path, file_size_bytes, record_count, created_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        job.id,
        job.dataset_id,
        organizationId,
        job.format,
        job.status,
        job.storage_path,
        job.file_size_bytes,
        job.record_count,
        job.created_at,
        job.completed_at
      )
      .run();

    return job;
  }

  /** {@inheritDoc IDatasetExportService.getExport} */
  async getExport(id: string): Promise<ExportJob | null> {
    const row = await this.db
      .prepare(`SELECT * FROM dataset_exports WHERE id = ?`)
      .bind(id)
      .first();
    return row ? this.mapRowToExportJob(row) : null;
  }

  /** {@inheritDoc IDatasetExportService.listExportsByDataset} */
  async listExportsByDataset(datasetId: string): Promise<readonly ExportJob[]> {
    const rows = await this.db
      .prepare(
        `SELECT * FROM dataset_exports WHERE dataset_id = ? ORDER BY created_at DESC`
      )
      .bind(datasetId)
      .all();
    return (rows.results ?? []).map(this.mapRowToExportJob);
  }

  /**
   * Convert an array of records to CSV format.
   *
   * @param records - The records to convert.
   * @returns CSV string with headers and rows.
   */
  private toCsv(records: Record<string, unknown>[]): string {
    if (records.length === 0) return "";
    const headers = Object.keys(records[0] ?? {});
    const lines = [headers.join(",")];
    for (const record of records) {
      lines.push(
        headers.map((h) => String(record[h] ?? "")).join(",")
      );
    }
    return lines.join("\n");
  }

  /**
   * Map a raw database row to a typed ExportJob object.
   *
   * @param row - The raw D1 row.
   * @returns A fully typed ExportJob.
   */
  private mapRowToExportJob(row: Record<string, unknown>): ExportJob {
    return {
      id: row.id as string,
      dataset_id: row.dataset_id as string,
      format: row.format as ExportFormat,
      status: row.status as ExportJob["status"],
      storage_path: row.storage_path as string | null,
      file_size_bytes: row.file_size_bytes as number | null,
      record_count: row.record_count as number | null,
      error: row.error as string | null,
      created_at: row.created_at as string,
      completed_at: row.completed_at as string | null,
    };
  }
}

import { z } from "zod";
import type { Result } from "@stratscope/core";
import { ok, err } from "@stratscope/core";
import type { AppError } from "@stratscope/core";
import { validationError, notFoundError, internalError } from "@stratscope/core";
import type { ResearchExport } from "../repositories/ResearchExportRepository";
import type { IResearchExportRepository } from "../repositories/ResearchExportRepository";

const CreateExportSchema = z.object({
  orgId: z.string().min(1),
  datasetId: z.string().optional(),
  benchmarkId: z.string().optional(),
  format: z.enum(["jsonl", "csv", "parquet", "json"]),
});

export interface IResearchExportService {
  createExport(params: {
    orgId: string;
    datasetId?: string;
    benchmarkId?: string;
    format: string;
  }): Promise<Result<ResearchExport, AppError>>;

  getExport(id: string): Promise<Result<ResearchExport, AppError>>;

  listExports(orgId: string): Promise<Result<readonly ResearchExport[], AppError>>;

  exportDataset(datasetId: string, format: string): Promise<Result<ResearchExport, AppError>>;

  exportBenchmarkResults(benchmarkId: string, format: string): Promise<Result<ResearchExport, AppError>>;
}

export class ResearchExportService implements IResearchExportService {
  constructor(private readonly repository: IResearchExportRepository) {}

  async createExport(params: {
    orgId: string;
    datasetId?: string;
    benchmarkId?: string;
    format: string;
  }): Promise<Result<ResearchExport, AppError>> {
    const validation = CreateExportSchema.safeParse(params);
    if (!validation.success) {
      return err(
        validationError(
          `Invalid export params: ${validation.error.issues.map((i) => i.message).join(", ")}`,
          validation.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          }))
        )
      );
    }

    const data = validation.data;

    const exportRecord: ResearchExport = {
      id: crypto.randomUUID(),
      organization_id: data.orgId,
      dataset_id: data.datasetId,
      benchmark_id: data.benchmarkId,
      format: data.format,
      record_count: 0,
      file_size_bytes: 0,
      storage_path: undefined,
      status: "pending",
      created_at: new Date().toISOString(),
      completed_at: undefined,
    };

    try {
      await this.repository.create(exportRecord);
      return ok(exportRecord);
    } catch (error) {
      return err(
        internalError(
          "Failed to create export",
          error instanceof Error ? { cause: error.message } : undefined
        )
      );
    }
  }

  async getExport(id: string): Promise<Result<ResearchExport, AppError>> {
    try {
      const exportRecord = await this.repository.findById(id);
      if (!exportRecord) {
        return err(notFoundError("ResearchExport", id));
      }
      return ok(exportRecord);
    } catch (error) {
      return err(
        internalError(
          "Failed to retrieve export",
          error instanceof Error ? { cause: error.message } : undefined
        )
      );
    }
  }

  async listExports(orgId: string): Promise<Result<readonly ResearchExport[], AppError>> {
    try {
      const exports = await this.repository.findByOrganizationId(orgId);
      return ok(exports);
    } catch (error) {
      return err(
        internalError(
          "Failed to list exports",
          error instanceof Error ? { cause: error.message } : undefined
        )
      );
    }
  }

  async exportDataset(datasetId: string, format: string): Promise<Result<ResearchExport, AppError>> {
    const validFormats = ["jsonl", "csv", "parquet", "json"];
    if (!validFormats.includes(format)) {
      return err(
        validationError(`Invalid format: ${format}. Must be one of: ${validFormats.join(", ")}`)
      );
    }

    try {
      const exportRecord: ResearchExport = {
        id: crypto.randomUUID(),
        organization_id: "",
        dataset_id: datasetId,
        benchmark_id: undefined,
        format,
        record_count: 0,
        file_size_bytes: 0,
        storage_path: undefined,
        status: "pending",
        created_at: new Date().toISOString(),
        completed_at: undefined,
      };

      await this.repository.create(exportRecord);

      const storagePath = `exports/datasets/${datasetId}/${exportRecord.id}.${format}`;
      await this.repository.updateStatus(exportRecord.id, "completed", storagePath);

      const completed: ResearchExport = {
        ...exportRecord,
        status: "completed",
        storage_path: storagePath,
        completed_at: new Date().toISOString(),
      };

      return ok(completed);
    } catch (error) {
      return err(
        internalError(
          "Failed to export dataset",
          error instanceof Error ? { cause: error.message } : undefined
        )
      );
    }
  }

  async exportBenchmarkResults(benchmarkId: string, format: string): Promise<Result<ResearchExport, AppError>> {
    const validFormats = ["jsonl", "csv", "parquet", "json"];
    if (!validFormats.includes(format)) {
      return err(
        validationError(`Invalid format: ${format}. Must be one of: ${validFormats.join(", ")}`)
      );
    }

    try {
      const exportRecord: ResearchExport = {
        id: crypto.randomUUID(),
        organization_id: "",
        dataset_id: undefined,
        benchmark_id: benchmarkId,
        format,
        record_count: 0,
        file_size_bytes: 0,
        storage_path: undefined,
        status: "pending",
        created_at: new Date().toISOString(),
        completed_at: undefined,
      };

      await this.repository.create(exportRecord);

      const storagePath = `exports/benchmarks/${benchmarkId}/${exportRecord.id}.${format}`;
      await this.repository.updateStatus(exportRecord.id, "completed", storagePath);

      const completed: ResearchExport = {
        ...exportRecord,
        status: "completed",
        storage_path: storagePath,
        completed_at: new Date().toISOString(),
      };

      return ok(completed);
    } catch (error) {
      return err(
        internalError(
          "Failed to export benchmark results",
          error instanceof Error ? { cause: error.message } : undefined
        )
      );
    }
  }
}

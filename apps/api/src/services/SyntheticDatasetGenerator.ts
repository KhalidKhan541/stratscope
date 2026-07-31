import type { Result } from "@stratscope/core";
import { ok, err } from "@stratscope/core";
import { notFoundError, internalError } from "@stratscope/core";
import type {
  SyntheticDataset,
  SyntheticDatasetRepository,
} from "../repositories/SyntheticDatasetRepository";

export interface GenerateDatasetParams {
  readonly orgId: string;
  readonly projectId: string;
  readonly name: string;
  readonly sourceModel: string;
  readonly recordCount: number;
  readonly schema: Record<string, unknown>;
  readonly config: Record<string, unknown>;
}

export class SyntheticDatasetGenerator {
  private readonly repository: SyntheticDatasetRepository;

  constructor(repository: SyntheticDatasetRepository) {
    this.repository = repository;
  }

  async generateDataset(params: GenerateDatasetParams): Promise<Result<SyntheticDataset>> {
    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      const dataset: SyntheticDataset = {
        id,
        organization_id: params.orgId,
        project_id: params.projectId,
        name: params.name,
        source_model: params.sourceModel,
        record_count: 0,
        schema_definition: params.schema,
        generation_config: params.config,
        status: "generating",
        created_at: now,
      };

      await this.repository.create(dataset);

      const generatedData = this.generateMockData(params.schema, params.recordCount);

      await this.repository.updateRecordCount(id, generatedData.length);
      await this.repository.updateStatus(id, "ready");

      const updated = await this.repository.findById(id);
      if (!updated) {
        return err(internalError("Dataset not found after generation"));
      }

      return ok(updated);
    } catch (error) {
      return err(internalError(
        "Failed to generate synthetic dataset",
        error instanceof Error ? { cause: error.message } : undefined,
      ));
    }
  }

  async getDataset(id: string): Promise<Result<SyntheticDataset>> {
    try {
      const dataset = await this.repository.findById(id);
      if (!dataset) {
        return err(notFoundError("SyntheticDataset", id));
      }
      return ok(dataset);
    } catch (error) {
      return err(internalError(
        "Failed to get synthetic dataset",
        error instanceof Error ? { cause: error.message } : undefined,
      ));
    }
  }

  async listDatasets(orgId: string): Promise<Result<readonly SyntheticDataset[]>> {
    try {
      const datasets = await this.repository.findByOrganizationId(orgId);
      return ok(datasets);
    } catch (error) {
      return err(internalError(
        "Failed to list synthetic datasets",
        error instanceof Error ? { cause: error.message } : undefined,
      ));
    }
  }

  private generateMockData(
    schema: Record<string, unknown>,
    count: number
  ): Record<string, unknown>[] {
    const records: Record<string, unknown>[] = [];
    for (let i = 0; i < count; i++) {
      const record: Record<string, unknown> = {};
      for (const [field, definition] of Object.entries(schema)) {
        record[field] = this.generateFieldValue(definition);
      }
      records.push(record);
    }
    return records;
  }

  private generateFieldValue(definition: unknown): unknown {
    if (typeof definition !== "object" || definition === null) {
      return null;
    }
    const def = definition as Record<string, unknown>;
    const type = def.type as string | undefined;
    switch (type) {
      case "string":
        return `generated_${crypto.randomUUID().slice(0, 8)}`;
      case "number":
        return Math.random() * 100;
      case "boolean":
        return Math.random() > 0.5;
      case "array":
        return [];
      case "object":
        return {};
      default:
        return null;
    }
  }
}

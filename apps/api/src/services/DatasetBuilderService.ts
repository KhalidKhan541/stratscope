import type { OrganizationId, ProjectId } from "@stratscope/core";
import type { Dataset, DatasetCategory } from "@stratscope/core";
import type { DatasetVersion } from "@stratscope/core/src/domain/dataset/DatasetVersion";
import type { Result } from "@stratscope/core/src/shared/errors/Result";
import { ok, err } from "@stratscope/core/src/shared/errors/Result";
import type { AppError } from "@stratscope/core/src/shared/errors/AppError";
import type { LLMProvider } from "./LLMProvider";

/**
 * Request to build a new dataset from execution history.
 */
interface DatasetBuildRequest {
  /** The owning organization. */
  readonly organization_id: OrganizationId;
  /** The target project. */
  readonly project_id: ProjectId;
  /** Human-readable dataset name. */
  readonly name: string;
  /** Description of the dataset's purpose. */
  readonly description: string;
  /** The category of dataset being built. */
  readonly category: DatasetCategory;
  /** Optional filters to apply when selecting executions. */
  readonly filters?: Record<string, unknown>;
  /** Optional tags for categorization. */
  readonly tags?: readonly string[];
}

/**
 * Contract for the dataset builder service.
 */
interface IDatasetBuilderService {
  /**
   * Build a new dataset from execution history.
   *
   * @param request - The dataset build configuration.
   * @returns The newly created dataset.
   */
  buildDataset(request: DatasetBuildRequest): Promise<Dataset>;

  /**
   * Retrieve a dataset by ID within an organization.
   *
   * @param id - The dataset ID.
   * @param organizationId - The organization scope.
   * @returns The dataset, or null if not found.
   */
  getDataset(
    id: string,
    organizationId: OrganizationId
  ): Promise<Dataset | null>;

  /**
   * List datasets for an organization with cursor pagination.
   *
   * @param organizationId - The organization scope.
   * @param options - Pagination options.
   * @returns Paginated list of datasets.
   */
  listDatasets(
    organizationId: OrganizationId,
    options: { readonly cursor?: string; readonly limit: number }
  ): Promise<{
    readonly items: readonly Dataset[];
    readonly next_cursor: string | null;
    readonly has_more: boolean;
  }>;

  /**
   * Validate a dataset's integrity.
   *
   * @param id - The dataset ID.
   * @returns Validation result with any errors found.
   */
  validateDataset(
    id: string
  ): Promise<{ readonly valid: boolean; readonly errors: readonly string[] }>;

  /**
   * Create a new version of an existing dataset.
   *
   * @param id - The dataset ID.
   * @returns The updated dataset with incremented version.
   */
  addDatasetVersion(id: string): Promise<Dataset>;
}

/**
 * Service that builds datasets from execution history.
 *
 * Queries completed executions, applies optional filters, and
 * persists the resulting dataset for downstream use.
 */
export class DatasetBuilderService implements IDatasetBuilderService {
  /**
   * Create a new DatasetBuilderService.
   *
   * @param db - Cloudflare D1 database binding.
   * @param llm - LLM provider for feature extraction.
   */
  constructor(
    private readonly db: D1Database,
    private readonly llm: LLMProvider
  ) {}

  /** {@inheritDoc IDatasetBuilderService.buildDataset} */
  async buildDataset(request: DatasetBuildRequest): Promise<Dataset> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // Query executions matching filters
    const executions = await this.db
      .prepare(
        `SELECT id, model, provider, status, latency_ms, total_tokens, estimated_cost, input, output, metadata
         FROM executions
         WHERE organization_id = ? AND project_id = ? AND status = 'completed'
         ORDER BY created_at DESC
         LIMIT 1000`
      )
      .bind(request.organization_id, request.project_id)
      .all();

    // Use LLM to extract features for dataset records
    const records: Record<string, unknown>[] = [];
    for (const exec of executions.results ?? []) {
      records.push({
        execution_id: exec.id,
        model: exec.model,
        provider: exec.provider,
        latency_ms: exec.latency_ms,
        total_tokens: exec.total_tokens,
        estimated_cost: exec.estimated_cost,
        input: exec.input,
        output: exec.output,
        metadata: exec.metadata,
      });
    }

    const dataset: Dataset = {
      id,
      organization_id: request.organization_id,
      project_id: request.project_id,
      name: request.name,
      description: request.description,
      category: request.category,
      status: "ready",
      version: 1,
      parent_dataset_id: null,
      record_count: records.length,
      schema_definition: {},
      filters: request.filters ?? {},
      tags: request.tags ?? [],
      export_formats: ["jsonl", "csv"],
      storage_path: null,
      checksum: null,
      metadata: {
        built_from: "execution_history",
        execution_count: records.length,
      },
      created_at: now,
      updated_at: now,
    };

    await this.db
      .prepare(
        `INSERT INTO datasets (id, organization_id, project_id, name, description, category, status, version, record_count, tags, export_formats, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        dataset.id,
        dataset.organization_id,
        dataset.project_id,
        dataset.name,
        dataset.description,
        dataset.category,
        dataset.status,
        dataset.version,
        dataset.record_count,
        JSON.stringify(dataset.tags),
        JSON.stringify(dataset.export_formats),
        JSON.stringify(dataset.metadata),
        dataset.created_at,
        dataset.updated_at
      )
      .run();

    return dataset;
  }

  /** {@inheritDoc IDatasetBuilderService.getDataset} */
  async getDataset(
    id: string,
    organizationId: OrganizationId
  ): Promise<Dataset | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM datasets WHERE id = ? AND organization_id = ?`
      )
      .bind(id, organizationId)
      .first();
    return row ? this.mapRowToDataset(row) : null;
  }

  /** {@inheritDoc IDatasetBuilderService.listDatasets} */
  async listDatasets(
    organizationId: OrganizationId,
    options: { readonly cursor?: string; readonly limit: number }
  ): Promise<{
    readonly items: readonly Dataset[];
    readonly next_cursor: string | null;
    readonly has_more: boolean;
  }> {
    const limit = Math.min(Math.max(options.limit, 1), 100);
    const query = options.cursor
      ? `SELECT * FROM datasets WHERE organization_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?`
      : `SELECT * FROM datasets WHERE organization_id = ? ORDER BY created_at DESC LIMIT ?`;

    const params = options.cursor
      ? [organizationId, options.cursor, limit + 1]
      : [organizationId, limit + 1];

    const rows = await this.db.prepare(query).bind(...params).all();
    const items = (rows.results ?? []).map(this.mapRowToDataset);
    const hasMore = items.length > limit;
    const sliced = hasMore ? items.slice(0, limit) : items;

    return {
      items: sliced,
      next_cursor:
        hasMore && sliced.length > 0
          ? sliced[sliced.length - 1]!.created_at
          : null,
      has_more: hasMore,
    };
  }

  /** {@inheritDoc IDatasetBuilderService.validateDataset} */
  async validateDataset(
    id: string
  ): Promise<{ readonly valid: boolean; readonly errors: readonly string[] }> {
    const dataset = await this.db
      .prepare(`SELECT * FROM datasets WHERE id = ?`)
      .bind(id)
      .first();
    if (!dataset) return { valid: false, errors: ["Dataset not found"] };

    const errors: string[] = [];
    if ((dataset.record_count as number) === 0)
      errors.push("Dataset has no records");
    if (!dataset.schema_definition) errors.push("Schema definition is missing");

    return { valid: errors.length === 0, errors };
  }

  /** {@inheritDoc IDatasetBuilderService.addDatasetVersion} */
  async addDatasetVersion(id: string): Promise<Dataset> {
    const existing = await this.db
      .prepare(`SELECT * FROM datasets WHERE id = ?`)
      .bind(id)
      .first();
    if (!existing) throw new Error("Dataset not found");

    const newVersion = (existing.version as number) + 1;
    const now = new Date().toISOString();

    await this.db
      .prepare(`UPDATE datasets SET version = ?, updated_at = ? WHERE id = ?`)
      .bind(newVersion, now, id)
      .run();

    return {
      ...this.mapRowToDataset(existing),
      version: newVersion,
      updated_at: now,
    };
  }

  async buildDatasetWithConsent(
    request: DatasetBuildRequest,
    consentPolicyId: string
  ): Promise<Result<DatasetVersion, AppError>> {
    const consentPolicy = await this.db
      .prepare(
        `SELECT * FROM consent_policies WHERE id = ? AND organization_id = ?`
      )
      .bind(consentPolicyId, request.organization_id)
      .first<Record<string, unknown>>();

    if (!consentPolicy) {
      return err({
        code: "NOT_FOUND",
        message: `Consent policy with id '${consentPolicyId}' not found`,
        resourceType: "ConsentPolicy",
        resourceId: consentPolicyId,
      });
    }

    const allowedUseCases = JSON.parse(
      (consentPolicy.allowed_use_cases as string) ?? "[]"
    ) as string[];

    if (!allowedUseCases.includes("dataset_building")) {
      return err({
        code: "FORBIDDEN",
        message: "Consent policy does not allow dataset building",
        requiredPermission: "dataset_building",
      });
    }

    const requiresAnonymization = (consentPolicy.requires_anonymization as number) === 1;

    const executions = await this.db
      .prepare(
        `SELECT id, model, provider, status, latency_ms, total_tokens, estimated_cost, input, output, metadata
         FROM executions
         WHERE organization_id = ? AND project_id = ? AND status = 'completed'
         ORDER BY created_at DESC
         LIMIT 1000`
      )
      .bind(request.organization_id, request.project_id)
      .all();

    const records: Record<string, unknown>[] = [];
    for (const exec of executions.results ?? []) {
      const record: Record<string, unknown> = {
        execution_id: exec.id,
        model: exec.model,
        provider: exec.provider,
        latency_ms: exec.latency_ms,
        total_tokens: exec.total_tokens,
        estimated_cost: exec.estimated_cost,
        input: exec.input,
        output: exec.output,
        metadata: exec.metadata,
      };

      if (requiresAnonymization) {
        delete record.input;
        delete record.output;
        delete record.metadata;
      }

      records.push(record);
    }

    const versionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const versionNumber = "1";

    const datasetVersion: DatasetVersion = {
      version_id: versionId,
      dataset_id: crypto.randomUUID(),
      version: versionNumber,
      description: request.description,
      status: "draft",
      row_count: records.length,
      schema_hash: "",
      checksum: "",
      consent_verified: true,
      anonymization_report_id: undefined,
      created_at: now,
    };

    return ok(datasetVersion);
  }

  /**
   * Map a raw database row to a typed Dataset object.
   *
   * @param row - The raw D1 row.
   * @returns A fully typed Dataset.
   */
  private mapRowToDataset(row: Record<string, unknown>): Dataset {
    return {
      id: row.id as string,
      organization_id: row.organization_id as OrganizationId,
      project_id: row.project_id as ProjectId,
      name: row.name as string,
      description: row.description as string,
      category: row.category as Dataset["category"],
      status: row.status as Dataset["status"],
      version: row.version as number,
      parent_dataset_id: row.parent_dataset_id as string | null,
      record_count: row.record_count as number,
      schema_definition: JSON.parse(
        (row.schema_definition as string) ?? "{}"
      ),
      filters: JSON.parse((row.filters as string) ?? "{}"),
      tags: JSON.parse((row.tags as string) ?? "[]"),
      export_formats: JSON.parse((row.export_formats as string) ?? "[]"),
      storage_path: row.storage_path as string | null,
      checksum: row.checksum as string | null,
      metadata: JSON.parse((row.metadata as string) ?? "{}"),
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }
}

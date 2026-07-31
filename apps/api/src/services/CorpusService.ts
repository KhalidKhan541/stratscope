import type { OrganizationId, ProjectId } from "@stratscope/core";
import type { Corpus } from "@stratscope/core";

/**
 * Contract for the corpus management service.
 */
interface ICorpusService {
  /**
   * Create a new corpus.
   *
   * @param params - Corpus configuration.
   * @returns The newly created corpus in draft status.
   */
  createCorpus(params: {
    /** The owning organization. */
    readonly organization_id: OrganizationId;
    /** The target project. */
    readonly project_id: ProjectId;
    /** Human-readable corpus name. */
    readonly name: string;
    /** Description of the corpus's purpose. */
    readonly description: string;
    /** Optional initial dataset IDs to include. */
    readonly dataset_ids?: readonly string[];
    /** Optional benchmark IDs to include. */
    readonly benchmark_ids?: readonly string[];
    /** Optional tags for categorization. */
    readonly tags?: readonly string[];
  }): Promise<Corpus>;

  /**
   * Retrieve a corpus by ID within an organization.
   *
   * @param id - The corpus ID.
   * @param organizationId - The organization scope.
   * @returns The corpus, or null if not found.
   */
  getCorpus(
    id: string,
    organizationId: OrganizationId
  ): Promise<Corpus | null>;

  /**
   * List corpora for an organization with cursor pagination.
   *
   * @param organizationId - The organization scope.
   * @param options - Pagination options.
   * @returns Paginated list of corpora.
   */
  listCorpora(
    organizationId: OrganizationId,
    options: { readonly cursor?: string; readonly limit: number }
  ): Promise<{
    readonly items: readonly Corpus[];
    readonly next_cursor: string | null;
    readonly has_more: boolean;
  }>;

  /**
   * Publish a corpus, making it available for use.
   *
   * @param id - The corpus ID.
   * @returns The updated corpus with published status.
   */
  publishCorpus(id: string): Promise<Corpus>;

  /**
   * Add a dataset to an existing corpus.
   *
   * @param corpusId - The corpus ID.
   * @param datasetId - The dataset ID to add.
   * @returns The updated corpus.
   */
  addDatasetToCorpus(corpusId: string, datasetId: string): Promise<Corpus>;
}

/**
 * Service for managing corpora.
 *
 * A corpus is a collection of datasets and benchmarks that can be
 * published and shared across an organization.
 */
export class CorpusService implements ICorpusService {
  /**
   * Create a new CorpusService.
   *
   * @param db - Cloudflare D1 database binding.
   */
  constructor(private readonly db: D1Database) {}

  /** {@inheritDoc ICorpusService.createCorpus} */
  async createCorpus(params: {
    /** The owning organization. */
    readonly organization_id: OrganizationId;
    /** The target project. */
    readonly project_id: ProjectId;
    /** Human-readable corpus name. */
    readonly name: string;
    /** Description of the corpus's purpose. */
    readonly description: string;
    /** Optional initial dataset IDs. */
    readonly dataset_ids?: readonly string[];
    /** Optional benchmark IDs. */
    readonly benchmark_ids?: readonly string[];
    /** Optional tags. */
    readonly tags?: readonly string[];
  }): Promise<Corpus> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const corpus: Corpus = {
      id,
      organization_id: params.organization_id,
      project_id: params.project_id,
      name: params.name,
      description: params.description,
      status: "draft",
      dataset_ids: params.dataset_ids ?? [],
      benchmark_ids: params.benchmark_ids ?? [],
      tags: params.tags ?? [],
      version: 1,
      metadata: {},
      created_at: now,
      updated_at: now,
    };

    await this.db
      .prepare(
        `INSERT INTO corpora (id, organization_id, project_id, name, description, status, dataset_ids, benchmark_ids, tags, version, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        corpus.id,
        corpus.organization_id,
        corpus.project_id,
        corpus.name,
        corpus.description,
        corpus.status,
        JSON.stringify(corpus.dataset_ids),
        JSON.stringify(corpus.benchmark_ids),
        JSON.stringify(corpus.tags),
        corpus.version,
        JSON.stringify(corpus.metadata),
        corpus.created_at,
        corpus.updated_at
      )
      .run();

    return corpus;
  }

  /** {@inheritDoc ICorpusService.getCorpus} */
  async getCorpus(
    id: string,
    organizationId: OrganizationId
  ): Promise<Corpus | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM corpora WHERE id = ? AND organization_id = ?`
      )
      .bind(id, organizationId)
      .first();
    return row ? this.mapRowToCorpus(row) : null;
  }

  /** {@inheritDoc ICorpusService.listCorpora} */
  async listCorpora(
    organizationId: OrganizationId,
    options: { readonly cursor?: string; readonly limit: number }
  ): Promise<{
    readonly items: readonly Corpus[];
    readonly next_cursor: string | null;
    readonly has_more: boolean;
  }> {
    const limit = Math.min(Math.max(options.limit, 1), 100);
    const query = options.cursor
      ? `SELECT * FROM corpora WHERE organization_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?`
      : `SELECT * FROM corpora WHERE organization_id = ? ORDER BY created_at DESC LIMIT ?`;
    const params = options.cursor
      ? [organizationId, options.cursor, limit + 1]
      : [organizationId, limit + 1];
    const rows = await this.db.prepare(query).bind(...params).all();
    const items = (rows.results ?? []).map(this.mapRowToCorpus);
    const hasMore = items.length > limit;
    const sliced = hasMore ? items.slice(0, limit) : items;
    return {
      items: sliced,
      next_cursor: hasMore && sliced.length > 0 ? sliced[sliced.length - 1]!.created_at : null,
      has_more: hasMore,
    };
  }

  /** {@inheritDoc ICorpusService.publishCorpus} */
  async publishCorpus(id: string): Promise<Corpus> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE corpora SET status = 'published', updated_at = ? WHERE id = ?`
      )
      .bind(now, id)
      .run();
    const row = await this.db
      .prepare(`SELECT * FROM corpora WHERE id = ?`)
      .bind(id)
      .first();
    return this.mapRowToCorpus(row!);
  }

  /** {@inheritDoc ICorpusService.addDatasetToCorpus} */
  async addDatasetToCorpus(
    corpusId: string,
    datasetId: string
  ): Promise<Corpus> {
    const row = await this.db
      .prepare(`SELECT * FROM corpora WHERE id = ?`)
      .bind(corpusId)
      .first();
    if (!row) throw new Error("Corpus not found");

    const datasets = JSON.parse(
      (row.dataset_ids as string) ?? "[]"
    ) as string[];
    if (!datasets.includes(datasetId)) datasets.push(datasetId);

    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE corpora SET dataset_ids = ?, updated_at = ? WHERE id = ?`
      )
      .bind(JSON.stringify(datasets), now, corpusId)
      .run();

    const updated = await this.db
      .prepare(`SELECT * FROM corpora WHERE id = ?`)
      .bind(corpusId)
      .first();
    return this.mapRowToCorpus(updated!);
  }

  /**
   * Map a raw database row to a typed Corpus object.
   *
   * @param row - The raw D1 row.
   * @returns A fully typed Corpus.
   */
  private mapRowToCorpus(row: Record<string, unknown>): Corpus {
    return {
      id: row.id as string,
      organization_id: row.organization_id as OrganizationId,
      project_id: row.project_id as ProjectId,
      name: row.name as string,
      description: row.description as string,
      status: row.status as Corpus["status"],
      dataset_ids: JSON.parse((row.dataset_ids as string) ?? "[]"),
      benchmark_ids: JSON.parse((row.benchmark_ids as string) ?? "[]"),
      tags: JSON.parse((row.tags as string) ?? "[]"),
      version: row.version as number,
      metadata: JSON.parse((row.metadata as string) ?? "{}"),
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }
}

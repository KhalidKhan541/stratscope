/**
 * D1-backed implementation of the KnowledgeRepository.
 *
 * Handles all persistence operations for Knowledge nodes and edges
 * using Cloudflare D1 with parameterized queries.
 */

import type { D1Database } from "@cloudflare/workers-types";
import type {
  OrganizationId,
  KnowledgeNodeId,
  KnowledgeEdgeId,
} from "@stratscope/core";

/**
 * Query parameters for listing knowledge nodes.
 */
export interface ListKnowledgeOptions {
  readonly organization_id: string;
  readonly cursor?: string;
  readonly limit: number;
  readonly node_type?: string;
}

/**
 * Paginated result set.
 */
export interface KnowledgePaginatedResult {
  readonly items: readonly Record<string, unknown>[];
  readonly next_cursor: string | null;
  readonly has_more: boolean;
}

/**
 * Raw D1 row shape for knowledge nodes.
 */
interface KnowledgeNodeRow {
  readonly id: string;
  readonly organization_id: string;
  readonly node_type: string;
  readonly name: string;
  readonly description: string;
  readonly properties: string;
  readonly created_at: string;
}

/**
 * Raw D1 row shape for knowledge edges.
 */
interface KnowledgeEdgeRow {
  readonly id: string;
  readonly source_node_id: string;
  readonly target_node_id: string;
  readonly edge_type: string;
  readonly properties: string;
  readonly created_at: string;
}

/**
 * Repository interface for knowledge persistence.
 */
export interface KnowledgeRepository {
  createNode(params: {
    readonly id: string;
    readonly organization_id: string;
    readonly node_type: string;
    readonly name: string;
    readonly description: string;
    readonly properties: Record<string, unknown>;
  }): Promise<void>;
  getNode(id: string): Promise<Record<string, unknown> | null>;
  listNodes(options: ListKnowledgeOptions): Promise<KnowledgePaginatedResult>;
  searchNodes(organizationId: string, query: string): Promise<readonly Record<string, unknown>[]>;
  createEdge(params: {
    readonly id: string;
    readonly source_node_id: string;
    readonly target_node_id: string;
    readonly edge_type: string;
    readonly properties: Record<string, unknown>;
  }): Promise<void>;
  getEdgesByNode(nodeId: string): Promise<readonly Record<string, unknown>[]>;
  countByOrganization(organizationId: string): Promise<number>;
}

/**
 * D1 implementation of the knowledge repository.
 */
export class D1KnowledgeRepository implements KnowledgeRepository {
  private readonly db: D1Database;
  private readonly nodesTable: string;
  private readonly edgesTable: string;

  constructor(
    db: D1Database,
    nodesTable: string = "knowledge_nodes",
    edgesTable: string = "knowledge_edges"
  ) {
    this.db = db;
    this.nodesTable = nodesTable;
    this.edgesTable = edgesTable;
  }

  async createNode(params: {
    readonly id: string;
    readonly organization_id: string;
    readonly node_type: string;
    readonly name: string;
    readonly description: string;
    readonly properties: Record<string, unknown>;
  }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO ${this.nodesTable} (
          id,
          organization_id,
          node_type,
          name,
          description,
          properties,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        params.id,
        params.organization_id,
        params.node_type,
        params.name,
        params.description,
        JSON.stringify(params.properties),
        new Date().toISOString()
      )
      .run();
  }

  async getNode(id: string): Promise<Record<string, unknown> | null> {
    const result = await this.db
      .prepare(`SELECT * FROM ${this.nodesTable} WHERE id = ?`)
      .bind(id)
      .first<KnowledgeNodeRow>();

    return result ? this.rowToRecord(result) : null;
  }

  async listNodes(options: ListKnowledgeOptions): Promise<KnowledgePaginatedResult> {
    const { organization_id, cursor, limit, node_type } = options;
    const normalizedLimit = Math.min(Math.max(1, limit), 100);

    let whereClause = "WHERE organization_id = ?";
    const params: unknown[] = [organization_id];

    if (node_type) {
      whereClause += " AND node_type = ?";
      params.push(node_type);
    }

    if (cursor) {
      whereClause += " AND created_at > (SELECT created_at FROM knowledge_nodes WHERE id = ?)";
      params.push(cursor);
    }

    const orderClause = "ORDER BY created_at ASC";
    const queryLimit = normalizedLimit + 1;

    const dataQuery = `SELECT * FROM ${this.nodesTable} ${whereClause} ${orderClause} LIMIT ?`;

    const dataResult = await this.db
      .prepare(dataQuery)
      .bind(...params, queryLimit)
      .all<KnowledgeNodeRow>();

    const rows = dataResult.results;
    const hasMore = rows.length > normalizedLimit;
    const items = hasMore ? rows.slice(0, normalizedLimit) : rows;
    const mappedItems = items.map((row) => this.rowToRecord(row));

    const nextCursor = hasMore && items.length > 0
      ? items[items.length - 1]!.id
      : null;

    return {
      items: Object.freeze(mappedItems),
      next_cursor: nextCursor,
      has_more: hasMore,
    };
  }

  async searchNodes(organizationId: string, query: string): Promise<readonly Record<string, unknown>[]> {
    const searchTerm = `%${query}%`;

    const result = await this.db
      .prepare(
        `SELECT * FROM ${this.nodesTable}
         WHERE organization_id = ?
         AND (name LIKE ? OR description LIKE ?)
         ORDER BY created_at DESC
         LIMIT 50`
      )
      .bind(organizationId, searchTerm, searchTerm)
      .all<KnowledgeNodeRow>();

    return Object.freeze(result.results.map((row) => this.rowToRecord(row)));
  }

  async createEdge(params: {
    readonly id: string;
    readonly source_node_id: string;
    readonly target_node_id: string;
    readonly edge_type: string;
    readonly properties: Record<string, unknown>;
  }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO ${this.edgesTable} (
          id,
          source_node_id,
          target_node_id,
          edge_type,
          properties,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        params.id,
        params.source_node_id,
        params.target_node_id,
        params.edge_type,
        JSON.stringify(params.properties),
        new Date().toISOString()
      )
      .run();
  }

  async getEdgesByNode(nodeId: string): Promise<readonly Record<string, unknown>[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM ${this.edgesTable}
         WHERE source_node_id = ? OR target_node_id = ?
         ORDER BY created_at DESC`
      )
      .bind(nodeId, nodeId)
      .all<KnowledgeEdgeRow>();

    return Object.freeze(result.results.map((row) => this.rowToEdgeRecord(row)));
  }

  async countByOrganization(organizationId: string): Promise<number> {
    const result = await this.db
      .prepare(
        `SELECT COUNT(*) as total FROM ${this.nodesTable}
         WHERE organization_id = ?`
      )
      .bind(organizationId)
      .first<{ readonly total: number }>();

    return result?.total ?? 0;
  }

  private rowToRecord(row: KnowledgeNodeRow): Record<string, unknown> {
    return {
      id: row.id,
      organization_id: row.organization_id,
      node_type: row.node_type,
      name: row.name,
      description: row.description,
      properties: JSON.parse(row.properties) as Record<string, unknown>,
      created_at: row.created_at,
    };
  }

  private rowToEdgeRecord(row: KnowledgeEdgeRow): Record<string, unknown> {
    return {
      id: row.id,
      source_node_id: row.source_node_id,
      target_node_id: row.target_node_id,
      edge_type: row.edge_type,
      properties: JSON.parse(row.properties) as Record<string, unknown>,
      created_at: row.created_at,
    };
  }
}

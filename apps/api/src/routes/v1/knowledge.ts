/**
 * Knowledge routes — knowledge graph queries.
 *
 * Handles knowledge node listing, search, and graph traversal queries.
 * All routes are versioned under /v1/knowledge.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../workers/env.js";
import { validate } from "../../middleware/validate.js";
import type { AuthContext } from "../../middleware/auth.js";

const knowledge = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const KNOWLEDGE_NODE_TYPE_ENUM = z.enum([
  "agent",
  "prompt",
  "workflow",
  "customer",
  "document",
  "tool",
  "execution",
  "task",
  "memory",
  "failure",
  "success",
]);

const KNOWLEDGE_EDGE_TYPE_ENUM = z.enum([
  "used",
  "failed",
  "generated",
  "corrected",
  "references",
  "improved",
  "similar",
  "belongs_to",
]);

const listKnowledgeQuerySchema = z.object({
  node_type: KNOWLEDGE_NODE_TYPE_ENUM.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

const searchKnowledgeQuerySchema = z.object({
  q: z.string().min(1, "Search query is required"),
  node_type: KNOWLEDGE_NODE_TYPE_ENUM.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10).optional(),
});

const graphQueryBodySchema = z.object({
  node_id: z.string().min(1, "node_id is required"),
  edge_types: z.array(KNOWLEDGE_EDGE_TYPE_ENUM).optional(),
  max_depth: z.coerce.number().int().min(1).max(5).default(2).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

interface KnowledgeNodeResponse {
  readonly id: string;
  readonly node_type: string;
  readonly name: string;
  readonly description: string | null;
  readonly metadata: Record<string, unknown>;
  readonly created_at: string;
}

interface KnowledgeEdgeResponse {
  readonly id: string;
  readonly source_node_id: string;
  readonly target_node_id: string;
  readonly edge_type: string;
  readonly metadata: Record<string, unknown>;
  readonly created_at: string;
}

interface KnowledgeListResponse {
  readonly data: readonly KnowledgeNodeResponse[];
  readonly pagination: {
    readonly cursor: string | null;
    readonly has_more: boolean;
    readonly limit: number;
  };
}

interface KnowledgeSearchResponse {
  readonly data: readonly KnowledgeNodeResponse[];
  readonly query: string;
  readonly total: number;
}

interface GraphQueryResponse {
  readonly nodes: readonly KnowledgeNodeResponse[];
  readonly edges: readonly KnowledgeEdgeResponse[];
  readonly root_node_id: string;
  readonly max_depth: number;
}

function toKnowledgeNodeResponse(row: Record<string, unknown>): KnowledgeNodeResponse {
  let metadata: Record<string, unknown> = {};
  if (typeof row["metadata"] === "string") {
    try {
      metadata = JSON.parse(row["metadata"]) as Record<string, unknown>;
    } catch {
      metadata = {};
    }
  }

  return {
    id: row["id"] as string,
    node_type: row["node_type"] as string,
    name: row["name"] as string,
    description: (row["description"] as string) ?? null,
    metadata,
    created_at: row["created_at"] as string,
  };
}

function toKnowledgeEdgeResponse(row: Record<string, unknown>): KnowledgeEdgeResponse {
  let metadata: Record<string, unknown> = {};
  if (typeof row["metadata"] === "string") {
    try {
      metadata = JSON.parse(row["metadata"]) as Record<string, unknown>;
    } catch {
      metadata = {};
    }
  }

  return {
    id: row["id"] as string,
    source_node_id: row["source_node_id"] as string,
    target_node_id: row["target_node_id"] as string,
    edge_type: row["edge_type"] as string,
    metadata,
    created_at: row["created_at"] as string,
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /v1/knowledge — List knowledge nodes
 */
knowledge.get(
  "/",
  validate({ query: listKnowledgeQuerySchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const query = c.req.valid("query") as any;

    const limit = query.limit ?? 20;
    const cursor = query.cursor;

    let whereClause = "WHERE organization_id = ?1";
    const params: unknown[] = [auth.organizationId];
    let paramIndex = 2;

    if (query.node_type) {
      whereClause += ` AND node_type = ?${paramIndex}`;
      params.push(query.node_type);
      paramIndex++;
    }

    if (cursor) {
      whereClause += ` AND created_at < (SELECT created_at FROM knowledge_nodes WHERE id = ?${paramIndex})`;
      params.push(cursor);
      paramIndex++;
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM knowledge_nodes ${whereClause}`
    )
      .bind(...params)
      .first<{ total: number }>();

    const total = countResult?.total ?? 0;

    const rows = await c.env.DB.prepare(
      `SELECT * FROM knowledge_nodes ${whereClause} ORDER BY created_at DESC LIMIT ?${paramIndex}`
    )
      .bind(...params, limit + 1)
      .all<Record<string, unknown>>();

    const hasMore = rows.results.length > limit;
    const items = rows.results.slice(0, limit).map(toKnowledgeNodeResponse);
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

    const response: KnowledgeListResponse = {
      data: items,
      pagination: {
        cursor: nextCursor,
        has_more: hasMore,
        limit,
      },
    };

    return c.json(response, 200);
  }
);

/**
 * GET /v1/knowledge/search — Search knowledge nodes
 */
knowledge.get(
  "/search",
  validate({ query: searchKnowledgeQuerySchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const query = c.req.valid("query") as any;

    const limit = query.limit ?? 10;

    let whereClause = "WHERE organization_id = ?1 AND (name LIKE ?2 OR description LIKE ?2)";
    const params: unknown[] = [auth.organizationId, `%${query.q}%`];
    let paramIndex = 3;

    if (query.node_type) {
      whereClause += ` AND node_type = ?${paramIndex}`;
      params.push(query.node_type);
      paramIndex++;
    }

    const rows = await c.env.DB.prepare(
      `SELECT * FROM knowledge_nodes ${whereClause} ORDER BY created_at DESC LIMIT ?${paramIndex}`
    )
      .bind(...params, limit)
      .all<Record<string, unknown>>();

    const items = rows.results.map(toKnowledgeNodeResponse);

    const response: KnowledgeSearchResponse = {
      data: items,
      query: query.q,
      total: items.length,
    };

    return c.json(response, 200);
  }
);

/**
 * POST /v1/knowledge/query — Graph traversal query
 */
knowledge.post(
  "/query",
  validate({ body: graphQueryBodySchema }),
  async (c) => {
    const auth = c.get("auth") as AuthContext;
    const body = c.req.valid("json") as any;

    const maxDepth = body.max_depth ?? 2;
    const limit = body.limit ?? 20;
    const edgeTypes = body.edge_types ?? [];

    // Verify root node exists and belongs to the organization
    const rootNode = await c.env.DB.prepare(
      `SELECT * FROM knowledge_nodes WHERE id = ?1 AND organization_id = ?2`
    )
      .bind(body.node_id, auth.organizationId)
      .first<Record<string, unknown>>();

    if (!rootNode) {
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Knowledge node with id '${body.node_id}' not found`,
          },
        },
        404
      );
    }

    // Collect nodes and edges through BFS traversal
    const visitedNodes = new Set<string>();
    const collectedNodes: KnowledgeNodeResponse[] = [];
    const collectedEdges: KnowledgeEdgeResponse[] = [];
    let currentLevel = [body.node_id];

    for (let depth = 0; depth < maxDepth && currentLevel.length > 0; depth++) {
      const nodeIds = currentLevel.filter((id) => !visitedNodes.has(id));

      if (nodeIds.length === 0) break;

      // Mark as visited
      for (const id of nodeIds) {
        visitedNodes.add(id);
      }

      // Fetch nodes
      const placeholders = nodeIds.map((_: string, i: number) => `?${i + 1}`).join(", ");
      const nodeRows = await c.env.DB.prepare(
        `SELECT * FROM knowledge_nodes WHERE id IN (${placeholders}) AND organization_id = ?${nodeIds.length + 1}`
      )
        .bind(...nodeIds, auth.organizationId)
        .all<Record<string, unknown>>();

      for (const row of nodeRows.results) {
        collectedNodes.push(toKnowledgeNodeResponse(row));
      }

      // Fetch edges from these nodes
      let edgeWhereClause = `WHERE source_node_id IN (${placeholders}) AND organization_id = ?${nodeIds.length + 1}`;
      const edgeParams: unknown[] = [...nodeIds, auth.organizationId];
      let edgeParamIndex = edgeParams.length + 1;

      if (edgeTypes.length > 0) {
        const edgeTypePlaceholders = edgeTypes.map((_: string, i: number) => `?${edgeParamIndex + i}`).join(", ");
        edgeWhereClause += ` AND edge_type IN (${edgeTypePlaceholders})`;
        edgeParams.push(...edgeTypes);
        edgeParamIndex += edgeTypes.length;
      }

      const edgeRows = await c.env.DB.prepare(
        `SELECT * FROM knowledge_edges ${edgeWhereClause} LIMIT ?${edgeParamIndex}`
      )
        .bind(...edgeParams, limit)
        .all<Record<string, unknown>>();

      const nextLevel: string[] = [];
      for (const row of edgeRows.results) {
        collectedEdges.push(toKnowledgeEdgeResponse(row));
        const targetId = row["target_node_id"] as string;
        if (!visitedNodes.has(targetId)) {
          nextLevel.push(targetId);
        }
      }

      currentLevel = nextLevel;
    }

    const response: GraphQueryResponse = {
      nodes: collectedNodes,
      edges: collectedEdges,
      root_node_id: body.node_id,
      max_depth: maxDepth,
    };

    return c.json(response, 200);
  }
);

export { knowledge as knowledgeRoutes };

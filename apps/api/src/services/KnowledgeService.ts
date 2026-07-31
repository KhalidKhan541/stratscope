/**
 * Knowledge Service — extracts and manages knowledge from execution history.
 *
 * Responsible for analyzing executions, extracting knowledge facts,
 * building the knowledge graph, and providing query capabilities.
 * Knowledge is the foundation for the learning system.
 */

import type { KnowledgeRepository } from "../repositories/KnowledgeRepository";
import type { LLMProvider } from "./LLMProvider";

/**
 * Service interface for knowledge operations.
 */
export interface IKnowledgeService {
  extractKnowledge(executionId: string, organizationId: string, projectId: string): Promise<readonly Record<string, unknown>[]>;
  getNode(id: string): Promise<Record<string, unknown> | null>;
  listByOrganization(organizationId: string, options: { cursor?: string; limit: number; node_type?: string }): Promise<{ items: readonly Record<string, unknown>[]; next_cursor: string | null; has_more: boolean }>;
  search(organizationId: string, query: string): Promise<readonly Record<string, unknown>[]>;
  createEdge(sourceId: string, targetId: string, edgeType: string, properties?: Record<string, unknown>): Promise<void>;
  getEdgesByNode(nodeId: string): Promise<readonly Record<string, unknown>[]>;
}

/**
 * Knowledge Service implementation.
 *
 * Orchestrates knowledge extraction and management, using LLM analysis
 * to identify entities, patterns, and relationships from execution history.
 */
export class KnowledgeService implements IKnowledgeService {
  constructor(
    private readonly repo: KnowledgeRepository,
    private readonly llm: LLMProvider
  ) {}

  async extractKnowledge(executionId: string, organizationId: string, projectId: string): Promise<readonly Record<string, unknown>[]> {
    const response = await this.llm.generate({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "Extract knowledge facts from this AI execution. Return a JSON array of objects with 'name', 'description', and 'node_type' fields. Node types: agent, prompt, workflow, execution, tool, memory, pattern, failure, success." },
        { role: "user", content: `Execution ID: ${executionId}` },
      ],
      response_format: { type: "json_object" },
    });

    const facts = JSON.parse(response.content) as Array<{ name: string; description: string; node_type: string }>;
    const created: Record<string, unknown>[] = [];

    for (const fact of facts) {
      const id = crypto.randomUUID();
      await this.repo.createNode({
        id,
        organization_id: organizationId,
        node_type: fact.node_type,
        name: fact.name,
        description: fact.description,
        properties: { execution_id: executionId, project_id: projectId },
      });
      created.push({ id, ...fact });
    }

    return created;
  }

  async getNode(id: string): Promise<Record<string, unknown> | null> {
    return this.repo.getNode(id);
  }

  async listByOrganization(organizationId: string, options: { cursor?: string; limit: number; node_type?: string }) {
    return this.repo.listNodes({ organization_id: organizationId, ...options });
  }

  async search(organizationId: string, query: string) {
    return this.repo.searchNodes(organizationId, query);
  }

  async createEdge(sourceId: string, targetId: string, edgeType: string, properties: Record<string, unknown> = {}) {
    await this.repo.createEdge({
      id: crypto.randomUUID(),
      source_node_id: sourceId,
      target_node_id: targetId,
      edge_type: edgeType,
      properties,
    });
  }

  async getEdgesByNode(nodeId: string) {
    return this.repo.getEdgesByNode(nodeId);
  }
}

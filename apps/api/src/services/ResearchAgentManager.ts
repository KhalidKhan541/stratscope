import type { OrganizationId, ProjectId } from "@stratscope/core";
import type { Result } from "@stratscope/core";
import { ok, err } from "@stratscope/core";
import { notFoundError, internalError } from "@stratscope/core";
import type { ResearchAgent, ResearchAgentStatus, ResearchAgentType } from "@stratscope/core/src/domain/research/ResearchAgent";
import { createResearchAgent } from "@stratscope/core/src/domain/research/ResearchAgent";
import type { ResearchAgentId } from "@stratscope/core/src/domain/types";
import type { ResearchAgentRepository } from "../repositories/ResearchAgentRepository";

export interface CreateResearchAgentParams {
  readonly organization_id: string;
  readonly project_id: string;
  readonly name: string;
  readonly description?: string;
  readonly agent_type: ResearchAgentType;
  readonly config?: Record<string, unknown>;
  readonly capabilities?: readonly string[];
}

export class ResearchAgentManager {
  private readonly repository: ResearchAgentRepository;

  constructor(repository: ResearchAgentRepository) {
    this.repository = repository;
  }

  async createResearchAgent(params: CreateResearchAgentParams): Promise<Result<ResearchAgent>> {
    try {
      const agent = createResearchAgent({
        id: crypto.randomUUID() as ResearchAgentId,
        organization_id: params.organization_id as OrganizationId,
        project_id: params.project_id as ProjectId,
        name: params.name,
        description: params.description,
        agent_type: params.agent_type,
        config: params.config,
        capabilities: params.capabilities,
      });

      await this.repository.create(agent);
      return ok(agent);
    } catch (error) {
      return err(internalError(
        "Failed to create research agent",
        error instanceof Error ? { cause: error.message } : undefined,
      ));
    }
  }

  async getResearchAgent(id: string): Promise<Result<ResearchAgent>> {
    try {
      const agent = await this.repository.findById(id);
      if (!agent) {
        return err(notFoundError("ResearchAgent", id));
      }
      return ok(agent);
    } catch (error) {
      return err(internalError(
        "Failed to get research agent",
        error instanceof Error ? { cause: error.message } : undefined,
      ));
    }
  }

  async listResearchAgents(orgId: string): Promise<Result<readonly ResearchAgent[]>> {
    try {
      const agents = await this.repository.findByOrganizationId(orgId);
      return ok(agents);
    } catch (error) {
      return err(internalError(
        "Failed to list research agents",
        error instanceof Error ? { cause: error.message } : undefined,
      ));
    }
  }

  async updateStatus(id: string, status: ResearchAgentStatus): Promise<Result<void>> {
    try {
      const existing = await this.repository.findById(id);
      if (!existing) {
        return err(notFoundError("ResearchAgent", id));
      }
      await this.repository.updateStatus(id, status);
      return ok(undefined);
    } catch (error) {
      return err(internalError(
        "Failed to update research agent status",
        error instanceof Error ? { cause: error.message } : undefined,
      ));
    }
  }

  async getActiveAgentsForProject(projectId: string): Promise<Result<readonly ResearchAgent[]>> {
    try {
      const agents = await this.repository.findByProjectId(projectId);
      const activeAgents = agents.filter((a) => a.status === "active");
      return ok(activeAgents);
    } catch (error) {
      return err(internalError(
        "Failed to get active agents for project",
        error instanceof Error ? { cause: error.message } : undefined,
      ));
    }
  }
}

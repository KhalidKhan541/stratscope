import { z } from "zod";
import type { Result } from "@stratscope/core";
import { ok, err } from "@stratscope/core";
import type { AppError } from "@stratscope/core";
import { validationError, notFoundError, internalError } from "@stratscope/core";
import type { Logger } from "@stratscope/core";
import type { ConsentPolicy } from "../repositories/ConsentPolicyRepository";
import type { IConsentPolicyRepository } from "../repositories/ConsentPolicyRepository";

export interface CreateConsentPolicyParams {
  readonly orgId: string;
  readonly projectId: string;
  readonly agentId: string;
  readonly scope: string;
  readonly allowedUseCases: readonly string[];
  readonly retentionDays: number;
  readonly requiresAnonymization: boolean;
}

export interface UpdateConsentPolicyParams {
  readonly scope?: string;
  readonly allowedUseCases?: readonly string[];
  readonly retentionDays?: number;
  readonly requiresAnonymization?: boolean;
  readonly status?: string;
}

export interface IConsentService {
  createConsentPolicy(params: CreateConsentPolicyParams): Promise<Result<ConsentPolicy, AppError>>;
  getConsentPolicy(id: string): Promise<Result<ConsentPolicy, AppError>>;
  updateConsentPolicy(id: string, updates: UpdateConsentPolicyParams): Promise<Result<ConsentPolicy, AppError>>;
  getConsentPoliciesForAgent(agentId: string): Promise<Result<readonly ConsentPolicy[], AppError>>;
  checkConsentForUseCase(agentId: string, useCase: string): Promise<Result<boolean, AppError>>;
}

const CreateConsentPolicySchema = z.object({
  orgId: z.string().min(1),
  projectId: z.string().min(1),
  agentId: z.string().min(1),
  scope: z.string().min(1),
  allowedUseCases: z.array(z.string().min(1)).min(1),
  retentionDays: z.number().int().positive(),
  requiresAnonymization: z.boolean(),
});

export class ConsentService implements IConsentService {
  private readonly repository: IConsentPolicyRepository;
  private readonly logger: Logger;

  constructor(repository: IConsentPolicyRepository, logger: Logger) {
    this.repository = repository;
    this.logger = logger;
  }

  async createConsentPolicy(params: CreateConsentPolicyParams): Promise<Result<ConsentPolicy, AppError>> {
    const validation = CreateConsentPolicySchema.safeParse(params);
    if (!validation.success) {
      const fieldErrors = validation.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return err(validationError(
        `Invalid consent policy payload: ${validation.error.issues.map((i) => i.message).join(", ")}`,
        fieldErrors,
      ));
    }

    const data = validation.data;
    const now = new Date().toISOString();
    const policyId = crypto.randomUUID();

    const policy: ConsentPolicy = {
      id: policyId,
      organization_id: data.orgId,
      project_id: data.projectId,
      agent_id: data.agentId,
      scope: data.scope,
      allowed_use_cases: data.allowedUseCases,
      retention_days: data.retentionDays,
      requires_anonymization: data.requiresAnonymization,
      status: "active",
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    try {
      await this.repository.create(policy);

      this.logger.info("Consent policy created", {
        consentPolicyId: policyId,
        organizationId: data.orgId,
        agentId: data.agentId,
      });

      return ok(policy);
    } catch (error) {
      this.logger.error("Failed to create consent policy", error instanceof Error ? error : undefined, {
        organizationId: data.orgId,
        agentId: data.agentId,
      });
      return err(internalError(
        "Failed to create consent policy",
        error instanceof Error ? { cause: error.message } : undefined,
      ));
    }
  }

  async getConsentPolicy(id: string): Promise<Result<ConsentPolicy, AppError>> {
    try {
      const policy = await this.repository.findById(id);
      if (!policy) {
        return err(notFoundError("ConsentPolicy", id));
      }
      return ok(policy);
    } catch (error) {
      this.logger.error("Failed to get consent policy", error instanceof Error ? error : undefined, {
        consentPolicyId: id,
      });
      return err(internalError(
        "Failed to retrieve consent policy",
        error instanceof Error ? { cause: error.message } : undefined,
      ));
    }
  }

  async updateConsentPolicy(id: string, updates: UpdateConsentPolicyParams): Promise<Result<ConsentPolicy, AppError>> {
    try {
      const existing = await this.repository.findById(id);
      if (!existing) {
        return err(notFoundError("ConsentPolicy", id));
      }

      const repoUpdates: Partial<ConsentPolicy> = {};
      if (updates.scope !== undefined) repoUpdates.scope = updates.scope;
      if (updates.allowedUseCases !== undefined) repoUpdates.allowed_use_cases = updates.allowedUseCases;
      if (updates.retentionDays !== undefined) repoUpdates.retention_days = updates.retentionDays;
      if (updates.requiresAnonymization !== undefined) repoUpdates.requires_anonymization = updates.requiresAnonymization;
      if (updates.status !== undefined) repoUpdates.status = updates.status;

      await this.repository.update(id, repoUpdates);

      const updated = await this.repository.findById(id);
      if (!updated) {
        return err(internalError("Consent policy not found after update"));
      }

      this.logger.info("Consent policy updated", {
        consentPolicyId: id,
        updatedFields: Object.keys(repoUpdates),
      });

      return ok(updated);
    } catch (error) {
      this.logger.error("Failed to update consent policy", error instanceof Error ? error : undefined, {
        consentPolicyId: id,
      });
      return err(internalError(
        "Failed to update consent policy",
        error instanceof Error ? { cause: error.message } : undefined,
      ));
    }
  }

  async getConsentPoliciesForAgent(agentId: string): Promise<Result<readonly ConsentPolicy[], AppError>> {
    try {
      const policies = await this.repository.findByAgentId(agentId);
      return ok(policies);
    } catch (error) {
      this.logger.error("Failed to get consent policies for agent", error instanceof Error ? error : undefined, {
        agentId,
      });
      return err(internalError(
        "Failed to retrieve consent policies",
        error instanceof Error ? { cause: error.message } : undefined,
      ));
    }
  }

  async checkConsentForUseCase(agentId: string, useCase: string): Promise<Result<boolean, AppError>> {
    try {
      const policies = await this.repository.findByAgentId(agentId);
      const hasConsent = policies.some(
        (policy) =>
          policy.status === "active" && policy.allowed_use_cases.includes(useCase)
      );
      return ok(hasConsent);
    } catch (error) {
      this.logger.error("Failed to check consent for use case", error instanceof Error ? error : undefined, {
        agentId,
        useCase,
      });
      return err(internalError(
        "Failed to check consent",
        error instanceof Error ? { cause: error.message } : undefined,
      ));
    }
  }
}

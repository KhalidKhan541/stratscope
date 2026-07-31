import { z } from "zod";
import type { Result } from "@stratscope/core";
import { ok, err } from "@stratscope/core";
import type { AppError } from "@stratscope/core";
import { validationError, notFoundError, conflictError, internalError } from "@stratscope/core";
import type { Experiment, ExperimentConfig, ExperimentResult } from "@stratscope/core/src/domain/experiment/Experiment";
import type { IExperimentRepository } from "../repositories/ExperimentRepository";

const CreateExperimentSchema = z.object({
  orgId: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  config: z.object({
    hypothesis: z.string(),
    variables: z.array(z.string()),
    control_group: z.string().optional(),
    treatment_group: z.string().optional(),
    sample_size: z.number().int().positive(),
    metrics: z.array(z.string()),
  }),
});

export interface IExperimentService {
  createExperiment(params: {
    orgId: string;
    projectId: string;
    name: string;
    description: string;
    config: ExperimentConfig;
  }): Promise<Result<Experiment, AppError>>;

  getExperiment(id: string): Promise<Result<Experiment, AppError>>;

  listExperiments(orgId: string): Promise<Result<readonly Experiment[], AppError>>;

  startExperiment(id: string): Promise<Result<void, AppError>>;

  completeExperiment(id: string, results: ExperimentResult[]): Promise<Result<void, AppError>>;

  cancelExperiment(id: string): Promise<Result<void, AppError>>;
}

export class ExperimentService implements IExperimentService {
  constructor(private readonly repository: IExperimentRepository) {}

  async createExperiment(params: {
    orgId: string;
    projectId: string;
    name: string;
    description: string;
    config: ExperimentConfig;
  }): Promise<Result<Experiment, AppError>> {
    const validation = CreateExperimentSchema.safeParse(params);
    if (!validation.success) {
      return err(
        validationError(
          `Invalid experiment params: ${validation.error.issues.map((i) => i.message).join(", ")}`,
          validation.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          }))
        )
      );
    }

    const data = validation.data;

    const experiment: Experiment = {
      experiment_id: crypto.randomUUID(),
      organization_id: data.orgId,
      project_id: data.projectId,
      name: data.name,
      description: data.description,
      status: "draft",
      config: data.config,
      results: [],
      created_at: new Date().toISOString(),
    };

    try {
      await this.repository.create(experiment);
      return ok(experiment);
    } catch (error) {
      return err(
        internalError(
          "Failed to create experiment",
          error instanceof Error ? { cause: error.message } : undefined
        )
      );
    }
  }

  async getExperiment(id: string): Promise<Result<Experiment, AppError>> {
    try {
      const experiment = await this.repository.findById(id);
      if (!experiment) {
        return err(notFoundError("Experiment", id));
      }
      return ok(experiment);
    } catch (error) {
      return err(
        internalError(
          "Failed to retrieve experiment",
          error instanceof Error ? { cause: error.message } : undefined
        )
      );
    }
  }

  async listExperiments(orgId: string): Promise<Result<readonly Experiment[], AppError>> {
    try {
      const experiments = await this.repository.findByOrganizationId(orgId);
      return ok(experiments);
    } catch (error) {
      return err(
        internalError(
          "Failed to list experiments",
          error instanceof Error ? { cause: error.message } : undefined
        )
      );
    }
  }

  async startExperiment(id: string): Promise<Result<void, AppError>> {
    try {
      const experiment = await this.repository.findById(id);
      if (!experiment) {
        return err(notFoundError("Experiment", id));
      }

      if (experiment.status !== "draft") {
        return err(
          conflictError(`Cannot start experiment in '${experiment.status}' status`)
        );
      }

      await this.repository.updateStatus(id, "running");
      return ok(undefined);
    } catch (error) {
      return err(
        internalError(
          "Failed to start experiment",
          error instanceof Error ? { cause: error.message } : undefined
        )
      );
    }
  }

  async completeExperiment(id: string, results: ExperimentResult[]): Promise<Result<void, AppError>> {
    try {
      const experiment = await this.repository.findById(id);
      if (!experiment) {
        return err(notFoundError("Experiment", id));
      }

      if (experiment.status !== "running") {
        return err(
          conflictError(`Cannot complete experiment in '${experiment.status}' status`)
        );
      }

      await this.repository.updateResults(id, results);
      await this.repository.updateStatus(id, "completed");
      return ok(undefined);
    } catch (error) {
      return err(
        internalError(
          "Failed to complete experiment",
          error instanceof Error ? { cause: error.message } : undefined
        )
      );
    }
  }

  async cancelExperiment(id: string): Promise<Result<void, AppError>> {
    try {
      const experiment = await this.repository.findById(id);
      if (!experiment) {
        return err(notFoundError("Experiment", id));
      }

      if (experiment.status === "completed" || experiment.status === "cancelled") {
        return err(
          conflictError(`Cannot cancel experiment in '${experiment.status}' status`)
        );
      }

      await this.repository.updateStatus(id, "cancelled");
      return ok(undefined);
    } catch (error) {
      return err(
        internalError(
          "Failed to cancel experiment",
          error instanceof Error ? { cause: error.message } : undefined
        )
      );
    }
  }
}

import type { ExperimentId } from "../types";

export type ExperimentStatus = "draft" | "running" | "completed" | "failed" | "cancelled";

export interface ExperimentConfig {
  readonly hypothesis: string;
  readonly variables: readonly string[];
  readonly control_group?: string;
  readonly treatment_group?: string;
  readonly sample_size: number;
  readonly metrics: readonly string[];
}

export interface ExperimentResult {
  readonly metric_name: string;
  readonly control_value: number;
  readonly treatment_value: number;
  readonly p_value: number;
  readonly confidence_interval: readonly [number, number];
  readonly significant: boolean;
}

export interface Experiment {
  readonly experiment_id: ExperimentId;
  readonly organization_id: string;
  readonly project_id: string;
  readonly name: string;
  readonly description: string;
  readonly status: ExperimentStatus;
  readonly config: ExperimentConfig;
  readonly results: readonly ExperimentResult[];
  readonly dataset_id?: string;
  readonly benchmark_id?: string;
  readonly created_at: string;
  readonly started_at?: string;
  readonly completed_at?: string;
}

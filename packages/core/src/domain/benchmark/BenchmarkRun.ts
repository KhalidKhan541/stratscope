import type { BenchmarkRunId } from "../types";

export type BenchmarkRunStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface BenchmarkRunMetric {
  readonly name: string;
  readonly value: number;
  readonly unit: string;
  readonly lower_bound?: number;
  readonly upper_bound?: number;
}

export interface BenchmarkRun {
  readonly run_id: BenchmarkRunId;
  readonly benchmark_id: string;
  readonly organization_id: string;
  readonly project_id: string;
  readonly status: BenchmarkRunStatus;
  readonly dataset_version_id?: string;
  readonly metrics: readonly BenchmarkRunMetric[];
  readonly execution_count: number;
  readonly total_cost: number;
  readonly total_tokens: number;
  readonly avg_latency_ms: number;
  readonly error_rate: number;
  readonly started_at?: string;
  readonly completed_at?: string;
  readonly created_at: string;
}

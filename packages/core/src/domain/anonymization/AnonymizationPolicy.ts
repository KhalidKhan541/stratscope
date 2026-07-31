import type { AnonymizationReportId } from "../types";

export type AnonymizationMethod = "hash" | "redact" | "mask" | "tokenize" | "differential_privacy";

export interface AnonymizationField {
  readonly field_path: string;
  readonly method: AnonymizationMethod;
  readonly params: Record<string, unknown>;
}

export interface AnonymizationPolicy {
  readonly report_id: AnonymizationReportId;
  readonly organization_id: string;
  readonly fields: readonly AnonymizationField[];
  readonly epsilon?: number;
  readonly delta?: number;
  readonly created_at: string;
}

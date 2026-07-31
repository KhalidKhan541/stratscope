import type { AnonymizationReportId } from "../types";
import type { DatasetVersionId } from "../../shared/ids/Ids";

export type DatasetVersionStatus = "draft" | "validated" | "published" | "archived";

export interface DatasetVersion {
  readonly version_id: DatasetVersionId;
  readonly dataset_id: string;
  readonly version: string;
  readonly description: string;
  readonly status: DatasetVersionStatus;
  readonly row_count: number;
  readonly schema_hash: string;
  readonly checksum: string;
  readonly consent_verified: boolean;
  readonly anonymization_report_id: AnonymizationReportId | undefined;
  readonly created_at: string;
}

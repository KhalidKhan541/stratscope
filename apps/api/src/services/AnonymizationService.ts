import type { Result } from "@stratscope/core";
import { ok, err } from "@stratscope/core";
import type { AppError } from "@stratscope/core";
import { validationError, internalError } from "@stratscope/core";
import type { Execution } from "@stratscope/core";
import type { AnonymizationPolicy } from "../repositories/AnonymizationPolicyRepository";

export interface IAnonymizationService {
  anonymizeExecution(execution: Execution, policy: AnonymizationPolicy): Promise<Result<Execution, AppError>>;
  anonymizeField(value: string, method: string, params: Record<string, unknown>): string;
  generateAnonymizationReport(orgId: string, fields: string[], method: string): AnonymizationPolicy;
}

const HASH_SALT = "stratscope-anonymization-v1";

export class AnonymizationService implements IAnonymizationService {
  async anonymizeExecution(execution: Execution, policy: AnonymizationPolicy): Promise<Result<Execution, AppError>> {
    if (policy.status !== "active") {
      return err(validationError("Anonymization policy is not active"));
    }

    try {
      const anonymizedMetadata = { ...execution.metadata };

      for (const field of policy.fields) {
        if (field in anonymizedMetadata) {
          const value = anonymizedMetadata[field];
          if (typeof value === "string") {
            const method = policy.methods[field] ?? policy.default_method;
            anonymizedMetadata[field] = this.anonymizeField(value, method, policy.params);
          }
        }
      }

      const anonymizedInput = execution.metadata.inputParameters
        ? { ...execution.metadata.inputParameters as Record<string, unknown> }
        : undefined;

      if (anonymizedInput) {
        for (const field of policy.fields) {
          if (field in anonymizedInput) {
            const value = anonymizedInput[field];
            if (typeof value === "string") {
              const method = policy.methods[field] ?? policy.default_method;
              anonymizedInput[field] = this.anonymizeField(value, method, policy.params);
            }
          }
        }
      }

      const result: Execution = {
        ...execution,
        metadata: {
          ...anonymizedMetadata,
          ...(anonymizedInput ? { inputParameters: anonymizedInput } : {}),
          anonymized: true,
          anonymization_policy_id: policy.id,
          anonymized_at: new Date().toISOString(),
        },
      };

      return ok(result);
    } catch (error) {
      return err(internalError(
        "Failed to anonymize execution",
        error instanceof Error ? { cause: error.message } : undefined,
      ));
    }
  }

  anonymizeField(value: string, method: string, params: Record<string, unknown>): string {
    switch (method) {
      case "hash":
        return this.hashValue(value, params);
      case "redact":
        return this.redactValue(value, params);
      case "mask":
        return this.maskValue(value, params);
      case "truncate":
        return this.truncateValue(value, params);
      case "replace":
        return this.replaceValue(value, params);
      case "remove":
        return "";
      default:
        return this.hashValue(value, params);
    }
  }

  generateAnonymizationReport(orgId: string, fields: string[], method: string): AnonymizationPolicy {
    const now = new Date().toISOString();
    const methods: Record<string, string> = {};
    for (const field of fields) {
      methods[field] = method;
    }

    return {
      id: crypto.randomUUID(),
      organization_id: orgId,
      name: `anonymization-report-${Date.now()}`,
      description: `Anonymization report for ${fields.length} fields using ${method} method`,
      methods,
      fields,
      default_method: method,
      params: {},
      status: "active",
      created_at: now,
      updated_at: now,
    };
  }

  private hashValue(value: string, params: Record<string, unknown>): string {
    const algorithm = (params.algorithm as string) ?? "sha256";
    let hash = 0;
    const input = HASH_SALT + value + algorithm;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, "0");
    return hex.repeat(4).slice(0, 32);
  }

  private redactValue(value: string, params: Record<string, unknown>): string {
    const replacement = (params.replacement as string) ?? "[REDACTED]";
    return replacement;
  }

  private maskValue(value: string, params: Record<string, unknown>): string {
    const maskChar = (params.maskChar as string) ?? "*";
    const visibleStart = (params.visibleStart as number) ?? 0;
    const visibleEnd = (params.visibleEnd as number) ?? 0;

    if (value.length <= visibleStart + visibleEnd) {
      return value;
    }

    const prefix = value.slice(0, visibleStart);
    const suffix = value.slice(value.length - visibleEnd);
    const maskedLength = value.length - visibleStart - visibleEnd;
    const masked = maskChar.repeat(maskedLength);
    return prefix + masked + suffix;
  }

  private truncateValue(value: string, params: Record<string, unknown>): string {
    const maxLength = (params.maxLength as number) ?? 10;
    if (value.length <= maxLength) {
      return value;
    }
    return value.slice(0, maxLength) + "...";
  }

  private replaceValue(value: string, params: Record<string, unknown>): string {
    const replacements = params.replacements as Record<string, string> | undefined;
    if (replacements && value in replacements) {
      return replacements[value];
    }
    const defaultValue = (params.defaultValue as string) ?? "[ANONYMIZED]";
    return defaultValue;
  }
}

import { describe, it, expect } from "vitest";
import { createDataset } from "./Dataset";
import type { OrganizationId, ProjectId } from "../../shared/ids/Ids";

describe("Dataset", () => {
  it("creates a dataset with defaults", () => {
    const dataset = createDataset({
      organization_id: "org-1" as OrganizationId,
      project_id: "proj-1" as ProjectId,
      name: "Failure Dataset",
      description: "Captures failure patterns",
      category: "failure",
    });

    expect(dataset.id).toBeDefined();
    expect(dataset.organization_id).toBe("org-1");
    expect(dataset.project_id).toBe("proj-1");
    expect(dataset.name).toBe("Failure Dataset");
    expect(dataset.description).toBe("Captures failure patterns");
    expect(dataset.category).toBe("failure");
    expect(dataset.status).toBe("building");
    expect(dataset.version).toBe(1);
    expect(dataset.record_count).toBe(0);
    expect(dataset.parent_dataset_id).toBeNull();
    expect(dataset.storage_path).toBeNull();
    expect(dataset.checksum).toBeNull();
  });

  it("creates a dataset with custom version", () => {
    const dataset = createDataset({
      organization_id: "org-1" as OrganizationId,
      project_id: "proj-1" as ProjectId,
      name: "Test",
      description: "",
      category: "reasoning",
      version: 3,
    });

    expect(dataset.version).toBe(3);
  });

  it("creates a dataset with parent_dataset_id", () => {
    const dataset = createDataset({
      organization_id: "org-1" as OrganizationId,
      project_id: "proj-1" as ProjectId,
      name: "Forked",
      description: "",
      category: "failure",
      parent_dataset_id: "ds-parent-1",
    });

    expect(dataset.parent_dataset_id).toBe("ds-parent-1");
  });

  it("creates a dataset with tags", () => {
    const dataset = createDataset({
      organization_id: "org-1" as OrganizationId,
      project_id: "proj-1" as ProjectId,
      name: "Tagged",
      description: "",
      category: "coding",
      tags: ["bug", "regression"],
    });

    expect(dataset.tags).toEqual(["bug", "regression"]);
  });

  it("creates a dataset with export_formats", () => {
    const dataset = createDataset({
      organization_id: "org-1" as OrganizationId,
      project_id: "proj-1" as ProjectId,
      name: "Exportable",
      description: "",
      category: "evaluation",
      export_formats: ["jsonl", "parquet"],
    });

    expect(dataset.export_formats).toEqual(["jsonl", "parquet"]);
  });

  it("creates a dataset with schema_definition and filters", () => {
    const schema = { type: "object", properties: { id: { type: "string" } } };
    const filters = { min_tokens: 100 };
    const dataset = createDataset({
      organization_id: "org-1" as OrganizationId,
      project_id: "proj-1" as ProjectId,
      name: "Schema Dataset",
      description: "",
      category: "knowledge",
      schema_definition: schema,
      filters,
    });

    expect(dataset.schema_definition).toEqual(schema);
    expect(dataset.filters).toEqual(filters);
  });

  it("creates a dataset with metadata", () => {
    const metadata = { author: "test", priority: "high" };
    const dataset = createDataset({
      organization_id: "org-1" as OrganizationId,
      project_id: "proj-1" as ProjectId,
      name: "Metadata Dataset",
      description: "",
      category: "planning",
      metadata,
    });

    expect(dataset.metadata).toEqual(metadata);
  });

  it("sets created_at and updated_at as ISO-8601 strings", () => {
    const dataset = createDataset({
      organization_id: "org-1" as OrganizationId,
      project_id: "proj-1" as ProjectId,
      name: "Timestamped",
      description: "",
      category: "research",
    });

    expect(dataset.created_at).toBeDefined();
    expect(dataset.updated_at).toBeDefined();
    expect(() => new Date(dataset.created_at)).not.toThrow();
    expect(() => new Date(dataset.updated_at)).not.toThrow();
  });

  it("uses default export_formats when not provided", () => {
    const dataset = createDataset({
      organization_id: "org-1" as OrganizationId,
      project_id: "proj-1" as ProjectId,
      name: "Default Formats",
      description: "",
      category: "failure",
    });

    expect(dataset.export_formats).toEqual(["jsonl", "csv"]);
  });
});

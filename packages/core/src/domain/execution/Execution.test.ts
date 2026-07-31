import { describe, it, expect } from "vitest";
import { createExecution } from "./Execution";
import type { ExecutionId, OrganizationId, ProjectId, AgentId } from "../../shared/ids/Ids";

describe("Execution", () => {
  it("creates an execution with required fields", () => {
    const exec = createExecution({
      execution_id: "exec-1" as ExecutionId,
      organization_id: "org-1" as OrganizationId,
      project_id: "proj-1" as ProjectId,
      model: "gpt-4",
      provider: "openai",
      trace_id: "trace-123",
      pipeline_version: "1.0.0",
      sdk_version: "1.0.0",
    });

    expect(exec.execution_id).toBe("exec-1");
    expect(exec.organization_id).toBe("org-1");
    expect(exec.project_id).toBe("proj-1");
    expect(exec.status).toBe("created");
    expect(exec.model).toBe("gpt-4");
    expect(exec.provider).toBe("openai");
    expect(exec.trace_id).toBe("trace-123");
    expect(exec.pipeline_version).toBe("1.0.0");
    expect(exec.sdk_version).toBe("1.0.0");
  });

  it("sets default values for optional fields", () => {
    const exec = createExecution({
      execution_id: "exec-1" as ExecutionId,
      organization_id: "org-1" as OrganizationId,
      project_id: "proj-1" as ProjectId,
      model: "gpt-4",
      provider: "openai",
      trace_id: "trace-1",
      pipeline_version: "1.0.0",
      sdk_version: "1.0.0",
    });

    expect(exec.agent_id).toBeNull();
    expect(exec.parent_execution_id).toBeNull();
    expect(exec.started_at).toBeNull();
    expect(exec.completed_at).toBeNull();
    expect(exec.latency_ms).toBeNull();
    expect(exec.queue_latency_ms).toBeNull();
    expect(exec.processing_latency_ms).toBeNull();
    expect(exec.input_tokens).toBe(0);
    expect(exec.output_tokens).toBe(0);
    expect(exec.total_tokens).toBe(0);
    expect(exec.estimated_cost).toBe(0);
    expect(exec.metadata).toEqual({});
    expect(exec.error).toBeNull();
  });

  it("creates an execution with agent_id", () => {
    const exec = createExecution({
      execution_id: "exec-1" as ExecutionId,
      organization_id: "org-1" as OrganizationId,
      project_id: "proj-1" as ProjectId,
      model: "gpt-4",
      provider: "openai",
      trace_id: "trace-1",
      pipeline_version: "1.0.0",
      sdk_version: "1.0.0",
      agent_id: "agent-1" as AgentId,
    });

    expect(exec.agent_id).toBe("agent-1");
  });

  it("creates an execution with parent_execution_id", () => {
    const exec = createExecution({
      execution_id: "exec-2" as ExecutionId,
      organization_id: "org-1" as OrganizationId,
      project_id: "proj-1" as ProjectId,
      model: "gpt-4",
      provider: "openai",
      trace_id: "trace-2",
      pipeline_version: "1.0.0",
      sdk_version: "1.0.0",
      parent_execution_id: "exec-1" as ExecutionId,
    });

    expect(exec.parent_execution_id).toBe("exec-1");
  });

  it("creates an execution with metadata", () => {
    const metadata = { key: "value", count: 42 };
    const exec = createExecution({
      execution_id: "exec-1" as ExecutionId,
      organization_id: "org-1" as OrganizationId,
      project_id: "proj-1" as ProjectId,
      model: "gpt-4",
      provider: "openai",
      trace_id: "trace-1",
      pipeline_version: "1.0.0",
      sdk_version: "1.0.0",
      metadata,
    });

    expect(exec.metadata).toEqual(metadata);
  });

  it("sets created_at as ISO-8601 string", () => {
    const exec = createExecution({
      execution_id: "exec-1" as ExecutionId,
      organization_id: "org-1" as OrganizationId,
      project_id: "proj-1" as ProjectId,
      model: "gpt-4",
      provider: "openai",
      trace_id: "trace-1",
      pipeline_version: "1.0.0",
      sdk_version: "1.0.0",
    });

    expect(exec.created_at).toBeDefined();
    expect(() => new Date(exec.created_at)).not.toThrow();
  });
});

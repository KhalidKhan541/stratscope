import { describe, it, expect } from "vitest";
import { createId } from "../../../../../packages/core/src/shared/ids/Ids";
import type {
  OrganizationId,
  ExecutionId,
  ProjectId,
} from "../../../../../packages/core/src/shared/ids/Ids";

describe("Branded IDs", () => {
  it("creates a branded OrganizationId", () => {
    const id = createId<OrganizationId>("org-123");
    expect(id).toBe("org-123");
  });

  it("creates a branded ExecutionId", () => {
    const id = createId<ExecutionId>("exec-456");
    expect(id).toBe("exec-456");
  });

  it("creates a branded ProjectId", () => {
    const id = createId<ProjectId>("proj-789");
    expect(id).toBe("proj-789");
  });

  it("createId returns a string", () => {
    const id = createId<ExecutionId>("exec-1");
    expect(typeof id).toBe("string");
  });

  it("preserves the exact input value", () => {
    const input = "org_abc_123_def";
    const id = createId<OrganizationId>(input);
    expect(id).toBe(input);
  });
});

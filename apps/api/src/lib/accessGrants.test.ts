import { describe, it, expect } from "vitest";
import { FakeD1 } from "../test/fakeD1.js";
import {
  issueAccessGrant,
  verifyAccessCredential,
  getAccessGrantById,
  listAccessGrants,
  revokeAccessGrant,
  generateCredential,
  sha256Hex,
} from "./accessGrants.js";

const db = new FakeD1({ access_grants: [] });

describe("accessGrants", () => {
  it("generates unique mag_ credentials", async () => {
    const a = generateCredential();
    const b = generateCredential();
    expect(a.startsWith("mag_")).toBe(true);
    expect(a).not.toBe(b);
  });

  it("sha256Hex hashes credentials deterministically", async () => {
    const hash1 = await sha256Hex("mag_abc123");
    const hash2 = await sha256Hex("mag_abc123");
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
    expect(hash1).not.toBe("mag_abc123");
  });

  it("issues an active grant storing only the credential hash", async () => {
    const { grant, credential } = await issueAccessGrant(db, {
      organizationId: "org-1",
      name: "Magma",
      agentIds: ["agent-1", "agent-2"],
      createdBy: "key-1",
    });

    expect(grant.organization_id).toBe("org-1");
    expect(grant.name).toBe("Magma");
    expect(grant.agent_ids).toEqual(["agent-1", "agent-2"]);
    expect(grant.status).toBe("active");
    expect(grant.created_by).toBe("key-1");

    const stored = db.tables["access_grants"][0];
    expect(stored["credential_hash"]).toBe(await sha256Hex(credential));
    expect(stored["credential_hash"]).not.toBe(credential);
  });

  it("verifies a valid credential and rejects unknown ones", async () => {
    const { credential } = await issueAccessGrant(db, {
      organizationId: "org-1",
      name: "Magma",
      agentIds: ["agent-1"],
    });

    const grant = await verifyAccessCredential(db, credential);
    expect(grant).not.toBeNull();
    expect(grant?.name).toBe("Magma");

    expect(await verifyAccessCredential(db, "mag_not-a-real-key")).toBeNull();
    expect(await verifyAccessCredential(db, "wrong-prefix-123")).toBeNull();
  });

  it("rejects credentials for revoked grants", async () => {
    const { grant, credential } = await issueAccessGrant(db, {
      organizationId: "org-2",
      name: "Revocable",
      agentIds: ["agent-1"],
    });

    await revokeAccessGrant(db, grant.id, "key-1");
    expect(await verifyAccessCredential(db, credential)).toBeNull();
  });

  it("lists only grants of the given organization", async () => {
    const grants = await listAccessGrants(db, "org-1");
    expect(grants.every((g) => g.organization_id === "org-1")).toBe(true);
    expect(grants.length).toBeGreaterThan(0);
  });

  it("revokeAccessGrant flips status and is idempotent", async () => {
    const { grant } = await issueAccessGrant(db, {
      organizationId: "org-3",
      name: "Once",
      agentIds: ["agent-1"],
    });

    expect(await revokeAccessGrant(db, grant.id, "key-1")).toBe(true);
    const revoked = await getAccessGrantById(db, grant.id);
    expect(revoked?.status).toBe("revoked");
    expect(revoked?.revoked_at).not.toBeNull();
    expect(await revokeAccessGrant(db, grant.id, "key-1")).toBe(false);
  });
});

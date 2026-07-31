import { describe, it, expect } from "vitest";

const API_URL = process.env.API_URL || "http://localhost:8787";
const TOKEN = process.env.API_TOKEN || "dev-token";

describe("StratScope API", () => {
  it("should return health check", async () => {
    const response = await fetch(`${API_URL}/v1/health`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.version).toBe("1.0.0");
  });

  it("should require auth for protected routes", async () => {
    const response = await fetch(`${API_URL}/v1/executions`);
    expect(response.status).toBe(401);
  });

  it("should accept valid auth header", async () => {
    const response = await fetch(`${API_URL}/v1/executions`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
    });

    expect(response.status).not.toBe(401);
  });

  it("should create an execution", async () => {
    const response = await fetch(`${API_URL}/v1/executions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        project_id: "test-project",
        input: "Test execution",
        model: "test-model",
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.id).toBeDefined();
    expect(data.status).toBe("created");
  });

  it("should list executions", async () => {
    const response = await fetch(`${API_URL}/v1/executions`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
  });
});

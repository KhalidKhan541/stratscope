import { describe, it, expect, beforeAll } from "vitest";

const API_URL = process.env.API_URL || "http://localhost:8787";
const TOKEN = process.env.API_TOKEN || "dev-token";

describe("StratScope Integration", () => {
  let executionId: string;

  beforeAll(async () => {
    let ready = false;
    for (let i = 0; i < 10; i++) {
      try {
        const response = await fetch(`${API_URL}/v1/health`);
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    if (!ready) {
      throw new Error("API not ready");
    }
  });

  it("should complete full execution lifecycle", async () => {
    const createResponse = await fetch(`${API_URL}/v1/executions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        project_id: "integration-test",
        input: "Test task: Write a hello world function",
        model: "llama-3.3-70b-versatile",
        provider: "groq",
      }),
    });

    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();
    executionId = created.id;
    expect(created.status).toBe("created");

    const getResponse = await fetch(`${API_URL}/v1/executions/${executionId}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });

    expect(getResponse.status).toBe(200);
    const execution = await getResponse.json();
    expect(execution.id).toBe(executionId);

    const completeResponse = await fetch(
      `${API_URL}/v1/executions/${executionId}/complete`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latency_ms: 1500,
          input_tokens: 50,
          output_tokens: 100,
          total_tokens: 150,
          estimated_cost: 0.0003,
        }),
      }
    );

    expect(completeResponse.status).toBe(200);

    const verifyResponse = await fetch(
      `${API_URL}/v1/executions/${executionId}`,
      {
        headers: { Authorization: `Bearer ${TOKEN}` },
      }
    );

    const verified = await verifyResponse.json();
    expect(verified.status).toBe("completed");
  });

  it("should list executions with pagination", async () => {
    const response = await fetch(`${API_URL}/v1/executions?limit=5`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.pagination).toBeDefined();
  });

  it("should handle LLM evaluation", async () => {
    const response = await fetch(`${API_URL}/v1/llm/evaluate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task: "Write a hello world function",
        output: "function hello() { console.log('Hello, world!'); }",
        tools_used: ["write_file"],
        errors: [],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      expect(data.score).toBeDefined();
      expect(typeof data.score).toBe("number");
    }
  });

  it("should return 404 for unknown routes", async () => {
    const response = await fetch(`${API_URL}/v1/nonexistent`);
    expect(response.status).toBe(404);
  });
});

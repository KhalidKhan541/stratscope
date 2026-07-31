import { describe, it, expect, vi, beforeEach } from "vitest";
import { StratScopeClient } from "../client";
import { EventBuffer } from "../buffer";
import { ExecutionHandleImpl } from "../execution";

describe("StratScopeClient", () => {
  let client: StratScopeClient;

  beforeEach(() => {
    client = new StratScopeClient({
      apiKey: "test-key",
      projectId: "proj-1",
      organizationId: "org-1",
      flushIntervalMs: 0, // Disable auto-flush in tests
    });
  });

  it("creates a client with default config", () => {
    expect(client).toBeDefined();
  });

  it("creates execution handle", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "exec-1", trace_id: "trace-1" }),
    }));

    const handle = await client.startExecution({ model: "gpt-4" });
    expect(handle).toBeDefined();
    expect(handle.executionId).toBe("exec-1");
    expect(handle.traceId).toBe("trace-1");
  });
});

describe("EventBuffer", () => {
  it("buffers events", () => {
    const buffer = new EventBuffer(10);
    expect(buffer.size()).toBe(0);

    buffer.push({ event_id: "1" } as any);
    expect(buffer.size()).toBe(1);
  });

  it("drains all events", () => {
    const buffer = new EventBuffer(10);
    buffer.push({ event_id: "1" } as any);
    buffer.push({ event_id: "2" } as any);

    const events = buffer.drain();
    expect(events).toHaveLength(2);
    expect(buffer.size()).toBe(0);
  });

  it("drops oldest when full", () => {
    const buffer = new EventBuffer(2);
    buffer.push({ event_id: "1" } as any);
    buffer.push({ event_id: "2" } as any);
    buffer.push({ event_id: "3" } as any);

    expect(buffer.size()).toBe(2);
    const events = buffer.drain();
    expect(events[0].event_id).toBe("2");
    expect(events[1].event_id).toBe("3");
  });
});

describe("ExecutionHandleImpl", () => {
  it("records model calls", () => {
    const buffer = new EventBuffer(100);
    const handle = new ExecutionHandleImpl({
      executionId: "exec-1",
      traceId: "trace-1",
      config: { apiKey: "k", projectId: "p", organizationId: "o", sdkVersion: "0.1.0", pipelineVersion: "1.0.0" } as any,
      buffer,
      client: { flush: vi.fn() } as any,
    });

    handle.recordModelCall({
      model: "gpt-4",
      provider: "openai",
      inputTokens: 100,
      outputTokens: 50,
      latencyMs: 200,
    });

    expect(buffer.size()).toBe(1);
  });
});
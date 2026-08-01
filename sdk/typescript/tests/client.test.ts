import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { StratScopeClient, StratScopeError } from "../src/index.js";
import type { StratScopeClientOptions } from "../src/index.js";

const DEFAULT_BASE_URL = "https://stratscope-api.khalidkhan.workers.dev";
const EXECUTION_RESPONSE = {
  success: true,
  data: { id: "exec_1", trace_id: "trace_1", status: "running" },
};

type FetchMock = Mock<(url: string, init: RequestInit) => ReturnType<typeof fetch>>;

function createClient(options: Partial<StratScopeClientOptions> = {}): StratScopeClient {
  return new StratScopeClient({
    apiKey: "test-api-key",
    projectId: "proj_test",
    agentId: "agent_test",
    ...options,
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockJson(mock: FetchMock, body: unknown, status = 200): void {
  mock.mockImplementation(() => Promise.resolve(jsonResponse(body, status)));
}

let mockFetch: FetchMock;

beforeEach(() => {
  mockFetch = vi.fn();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("StratScopeClient.startExecution", () => {
  it("posts the correct URL, headers and body and returns { id, traceId }", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(EXECUTION_RESPONSE, 201));
    const client = createClient({ model: "llama-3.3-70b-versatile", provider: "groq" });

    const execution = await client.startExecution({
      traceId: "trace_custom",
      metadata: { session: "abc" },
    });

    expect(execution).toMatchObject({ id: "exec_1", traceId: "trace_1" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toBe(`${DEFAULT_BASE_URL}/v1/ingest/executions`);
    expect(init.method).toBe("POST");
    const headers = init.headers as unknown as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-api-key");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-StratScope-SDK"]).toBe("typescript-0.1.0");
    expect(JSON.parse(String(init.body))).toEqual({
      project_id: "proj_test",
      agent_id: "agent_test",
      model: "llama-3.3-70b-versatile",
      provider: "groq",
      trace_id: "trace_custom",
      sdk_version: "0.1.0",
      metadata: { session: "abc" },
    });
  });

  it("omits optional fields from the body when not provided", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(EXECUTION_RESPONSE, 201));
    const client = createClient();

    await client.startExecution();

    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(String(init.body))).toEqual({
      project_id: "proj_test",
      agent_id: "agent_test",
      sdk_version: "0.1.0",
    });
  });

  it("honors a custom baseUrl (trailing slash trimmed) and sdkVersion header", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(EXECUTION_RESPONSE, 201));
    const client = createClient({ baseUrl: "https://example.com/", sdkVersion: "0.2.0" });

    await client.startExecution();

    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toBe("https://example.com/v1/ingest/executions");
    const headers = init.headers as unknown as Record<string, string>;
    expect(headers["X-StratScope-SDK"]).toBe("typescript-0.2.0");
  });

  it("throws StratScopeError with the server message on 401 without retrying", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ success: false, error: { message: "invalid api key" } }, 401)
    );
    const client = createClient();

    const error = await client.startExecution().then(
      () => null,
      (e: unknown) => e
    );

    expect(error).toBeInstanceOf(StratScopeError);
    expect((error as StratScopeError).status).toBe(401);
    expect((error as StratScopeError).message).toContain("invalid api key");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries once on network failure and then succeeds", async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(jsonResponse(EXECUTION_RESPONSE, 201));
    const client = createClient();

    const execution = await client.startExecution();

    expect(execution.id).toBe("exec_1");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("retries once on a 500 server error and then throws StratScopeError", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ success: false, error: { message: "boom" } }, 500))
      .mockResolvedValueOnce(jsonResponse({ success: false, error: { message: "boom" } }, 500));
    const client = createClient();

    const error = await client.startExecution().then(
      () => null,
      (e: unknown) => e
    );

    expect(error).toBeInstanceOf(StratScopeError);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("Execution.event", () => {
  it("buffers events and flushes them as a single batch of 20", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(EXECUTION_RESPONSE, 201));
    mockJson(mockFetch, { success: true, data: { inserted: 20 } }, 201);
    const client = createClient();

    const execution = await client.startExecution();
    for (let i = 0; i < 20; i += 1) {
      const metadata = i === 19 ? { source: "worker" } : undefined;
      execution.event({ eventType: "step.started", payload: { index: i }, metadata });
    }

    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    const [url, init] = mockFetch.mock.calls[1];
    expect(String(url)).toBe(`${DEFAULT_BASE_URL}/v1/ingest/events`);
    const body = JSON.parse(String(init.body)) as { batch: Array<Record<string, unknown>> };
    expect(body.batch).toHaveLength(20);
    expect(body.batch[0]).toEqual({
      event_type: "step.started",
      execution_id: "exec_1",
      payload: { index: 0 },
    });
    expect(body.batch[19]).toEqual({
      event_type: "step.started",
      execution_id: "exec_1",
      payload: { index: 19 },
      metadata: { source: "worker" },
    });
  });

  it("does not flush before 20 events are buffered", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(EXECUTION_RESPONSE, 201));
    const client = createClient();

    const execution = await client.startExecution();
    for (let i = 0; i < 19; i += 1) {
      execution.event({ eventType: "step.started", payload: { index: i } });
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries once on network failure and never throws", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFetch
      .mockResolvedValueOnce(jsonResponse(EXECUTION_RESPONSE, 201))
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { inserted: 20 } }, 201));
    const client = createClient();

    const execution = await client.startExecution();
    for (let i = 0; i < 20; i += 1) {
      execution.event({ eventType: "step.started", payload: { index: i } });
    }

    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3));
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("drops the batch with a warning when the retry also fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFetch
      .mockResolvedValueOnce(jsonResponse(EXECUTION_RESPONSE, 201))
      .mockRejectedValue(new TypeError("network down"));
    const client = createClient();

    const execution = await client.startExecution();
    for (let i = 0; i < 20; i += 1) {
      execution.event({ eventType: "step.started", payload: { index: i } });
    }

    await vi.waitFor(() => expect(warnSpy).toHaveBeenCalled());
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("never sends more than 500 events in a single batch", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(EXECUTION_RESPONSE, 201));
    mockJson(mockFetch, { success: true, data: { inserted: 20 } }, 201);
    const client = createClient();

    const execution = await client.startExecution();
    for (let i = 0; i < 520; i += 1) {
      execution.event({ eventType: "step.started", payload: { index: i } });
    }

    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(27));
    const eventCalls = mockFetch.mock.calls.slice(1);
    expect(eventCalls).toHaveLength(26);
    for (const [, init] of eventCalls) {
      const body = JSON.parse(String(init.body)) as { batch: Array<Record<string, unknown>> };
      expect(body.batch.length).toBeLessThanOrEqual(500);
      expect(body.batch.length).toBe(20);
    }
  });
});

describe("Execution.finish", () => {
  it("flushes buffered events then PATCHes the execution with stats", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(EXECUTION_RESPONSE, 201));
    mockJson(mockFetch, { success: true, data: { inserted: 3 } }, 201);
    const client = createClient();

    const execution = await client.startExecution();
    execution.event({ eventType: "step.started", payload: { step: "extract" } });
    execution.event({ eventType: "step.completed", payload: { step: "extract", rows: 42 } });
    execution.event({ eventType: "step.completed", payload: { step: "normalize", rows: 7 } });

    await execution.finish({
      status: "completed",
      latencyMs: 1200,
      costUsd: 0.0032,
      tokensIn: 1200,
      tokensOut: 900,
    });

    expect(mockFetch).toHaveBeenCalledTimes(3);
    const eventsBody = JSON.parse(String(mockFetch.mock.calls[1][1].body)) as {
      batch: Array<Record<string, unknown>>;
    };
    expect(eventsBody.batch).toHaveLength(3);
    const [patchUrl, patchInit] = mockFetch.mock.calls[2];
    expect(String(patchUrl)).toBe(`${DEFAULT_BASE_URL}/v1/ingest/executions/exec_1`);
    expect(patchInit.method).toBe("PATCH");
    expect(JSON.parse(String(patchInit.body))).toEqual({
      status: "completed",
      latency_ms: 1200,
      cost_usd: 0.0032,
      tokens_in: 1200,
      tokens_out: 900,
    });
  });

  it("sends status failed with the error field", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(EXECUTION_RESPONSE, 201));
    mockJson(mockFetch, { success: true, data: {} });
    const client = createClient();

    const execution = await client.startExecution();
    await execution.finish({ status: "failed", error: "rate limit exceeded" });

    const [, patchInit] = mockFetch.mock.calls[1];
    expect(patchInit.method).toBe("PATCH");
    expect(JSON.parse(String(patchInit.body))).toEqual({
      status: "failed",
      error: "rate limit exceeded",
    });
  });

  it("retries once on network failure and never throws", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFetch
      .mockResolvedValueOnce(jsonResponse(EXECUTION_RESPONSE, 201))
      .mockRejectedValueOnce(new TypeError("network down"));
    mockJson(mockFetch, { success: true, data: { status: "completed" } });
    const client = createClient();

    const execution = await client.startExecution();
    await execution.finish({ status: "completed", latencyMs: 10 });

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

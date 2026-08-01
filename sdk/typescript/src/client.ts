const API_BASE_URL = "https://stratscope-api.khalidkhan.workers.dev";
const DEFAULT_SDK_VERSION = "0.1.0";
const EVENT_FLUSH_THRESHOLD = 20;
const EVENT_MAX_BATCH_SIZE = 500;
const REQUEST_TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 500;
const SDK_HEADER_PREFIX = "typescript";
const CONTENT_TYPE_JSON = "application/json";
const WARN_PREFIX = "[stratscope-sdk] ";

const HEADER_AUTHORIZATION = "Authorization";
const HEADER_CONTENT_TYPE = "Content-Type";
const HEADER_SDK = "X-StratScope-SDK";

const METHOD_POST = "POST";
const METHOD_PATCH = "PATCH";

const INGEST_EXECUTIONS_PATH = "/v1/ingest/executions";
const INGEST_EVENTS_PATH = "/v1/ingest/events";

type HttpMethod = typeof METHOD_POST | typeof METHOD_PATCH;

export interface StratScopeClientOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly projectId: string;
  readonly agentId: string;
  readonly model?: string;
  readonly provider?: string;
  readonly sdkVersion?: string;
}

export interface StartExecutionOptions {
  readonly model?: string;
  readonly provider?: string;
  readonly traceId?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface EventInput {
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
}

export interface FinishInput {
  readonly status: "completed" | "failed";
  readonly latencyMs?: number;
  readonly costUsd?: number;
  readonly tokensIn?: number;
  readonly tokensOut?: number;
  readonly error?: string;
}

export interface Execution {
  readonly id: string;
  readonly traceId: string;
  event(input: EventInput): void;
  finish(input: FinishInput): Promise<void>;
}

export class StratScopeError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "StratScopeError";
    this.status = status;
  }
}

function withoutUndefined(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      output[key] = value;
    }
  }
  return output;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof StratScopeError) {
    return error.status >= 500;
  }
  return true;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class StratScopeClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly projectId: string;
  private readonly agentId: string;
  private readonly model?: string;
  private readonly provider?: string;
  private readonly sdkVersion: string;

  constructor(options: StratScopeClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? API_BASE_URL).replace(/\/+$/, "");
    this.projectId = options.projectId;
    this.agentId = options.agentId;
    this.model = options.model;
    this.provider = options.provider;
    this.sdkVersion = options.sdkVersion ?? DEFAULT_SDK_VERSION;
  }

  async startExecution(options: StartExecutionOptions = {}): Promise<Execution> {
    const body = withoutUndefined({
      project_id: this.projectId,
      agent_id: this.agentId,
      model: options.model ?? this.model,
      provider: options.provider ?? this.provider,
      trace_id: options.traceId,
      sdk_version: this.sdkVersion,
      metadata: options.metadata,
    });

    const data = (await this.requestWithRetry(METHOD_POST, INGEST_EXECUTIONS_PATH, body)) as Record<
      string,
      unknown
    >;
    const id = data.id;
    const traceId = data.trace_id;
    if (typeof id !== "string" || typeof traceId !== "string") {
      throw new StratScopeError("StratScope API returned an execution without id or trace_id", 200);
    }

    let buffer: EventInput[] = [];

    const flushBuffer = async (): Promise<void> => {
      const pending = buffer;
      buffer = [];
      if (pending.length === 0) {
        return;
      }
      const batch = pending.map((event) =>
        withoutUndefined({
          event_type: event.eventType,
          execution_id: id,
          payload: event.payload,
          metadata: event.metadata,
        })
      );
      for (let offset = 0; offset < batch.length; offset += EVENT_MAX_BATCH_SIZE) {
        await this.sendEvents(batch.slice(offset, offset + EVENT_MAX_BATCH_SIZE));
      }
    };

    return {
      id,
      traceId,
      event: (input: EventInput): void => {
        buffer.push(input);
        if (buffer.length >= EVENT_FLUSH_THRESHOLD) {
          void flushBuffer();
        }
      },
      finish: async (input: FinishInput): Promise<void> => {
        await flushBuffer();
        const payload = withoutUndefined({
          status: input.status,
          latency_ms: input.latencyMs,
          cost_usd: input.costUsd,
          tokens_in: input.tokensIn,
          tokens_out: input.tokensOut,
          error: input.error,
        });
        await this.sendPatch(`${INGEST_EXECUTIONS_PATH}/${id}`, payload);
      },
    };
  }

  private async sendEvents(batch: ReadonlyArray<Record<string, unknown>>): Promise<void> {
    try {
      await this.requestWithRetry(METHOD_POST, INGEST_EVENTS_PATH, { batch });
    } catch (error) {
      console.warn(`${WARN_PREFIX}failed to send event batch: ${describeError(error)}`);
    }
  }

  private async sendPatch(path: string, payload: Record<string, unknown>): Promise<void> {
    try {
      await this.requestWithRetry(METHOD_PATCH, path, payload);
    } catch (error) {
      console.warn(`${WARN_PREFIX}failed to finish execution: ${describeError(error)}`);
    }
  }

  private async requestWithRetry(
    method: HttpMethod,
    path: string,
    body: Record<string, unknown>
  ): Promise<unknown> {
    try {
      return await this.requestOnce(method, path, body);
    } catch (error) {
      if (!isRetryableError(error)) {
        throw error;
      }
      await delay(RETRY_DELAY_MS);
      return this.requestOnce(method, path, body);
    }
  }

  private async requestOnce(
    method: HttpMethod,
    path: string,
    body: Record<string, unknown>
  ): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        [HEADER_AUTHORIZATION]: `Bearer ${this.apiKey}`,
        [HEADER_CONTENT_TYPE]: CONTENT_TYPE_JSON,
        [HEADER_SDK]: `${SDK_HEADER_PREFIX}-${this.sdkVersion}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw await this.buildError(response);
    }

    const json: unknown = await response.json();
    if (!isRecord(json) || !isRecord(json.data)) {
      throw new StratScopeError(
        `StratScope API returned an unexpected response (HTTP ${response.status})`,
        response.status
      );
    }
    return json.data;
  }

  private async buildError(response: Response): Promise<StratScopeError> {
    const raw = await response.text();
    let message = raw.length > 0 ? raw : response.statusText;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isRecord(parsed)) {
        const error = parsed.error;
        if (isRecord(error) && typeof error.message === "string" && error.message.length > 0) {
          message = error.message;
        } else if (typeof parsed.message === "string" && parsed.message.length > 0) {
          message = parsed.message;
        }
      }
    } catch {
      // non-JSON error body; keep raw text
    }
    return new StratScopeError(`StratScope API error ${response.status}: ${message}`, response.status);
  }
}

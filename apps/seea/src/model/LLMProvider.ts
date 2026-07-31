export interface LLMMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface LLMRequest {
  readonly messages: readonly LLMMessage[];
  readonly model: string;
  readonly max_tokens?: number;
  readonly temperature?: number;
  readonly top_p?: number;
}

export interface LLMResponse {
  readonly content: string;
  readonly model: string;
  readonly tokens_used: number;
  readonly prompt_tokens: number;
  readonly completion_tokens: number;
  readonly latency_ms: number;
  readonly finish_reason: string;
}

export interface LLMProvider {
  readonly name: string;
  complete(request: LLMRequest): Promise<LLMResponse>;
}
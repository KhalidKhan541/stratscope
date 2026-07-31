/**
 * Abstract LLM provider interface.
 *
 * Business logic never depends on a specific provider.
 * Only this interface is consumed by services.
 */

/**
 * A single message in a chat completion request.
 */
export interface LLMMessage {
  /** The role of the message sender. */
  readonly role: "system" | "user" | "assistant";
  /** The textual content of the message. */
  readonly content: string;
}

/**
 * The response returned by an LLM provider after a completion request.
 */
export interface LLMResponse {
  /** The generated text content. */
  readonly content: string;
  /** The model identifier used for generation. */
  readonly model: string;
  /** Token usage statistics for the request. */
  readonly usage: {
    /** Number of tokens in the prompt. */
    readonly prompt_tokens: number;
    /** Number of tokens in the completion. */
    readonly completion_tokens: number;
    /** Total tokens consumed. */
    readonly total_tokens: number;
  };
  /** The reason generation stopped. */
  readonly finish_reason: "stop" | "length" | "tool_call" | "unknown";
  /** Wall-clock latency of the request in milliseconds. */
  readonly latency_ms: number;
}

/**
 * Abstract LLM provider interface.
 *
 * Business logic never depends on a specific provider.
 * Only this interface is consumed by services.
 */
export interface LLMProvider {
  /** Human-readable provider name. */
  readonly name: string;

  /**
   * Generate a chat completion.
   *
   * @param params - The generation parameters including model, messages, and optional settings.
   * @returns The LLM response with generated content and usage metadata.
   */
  generate(params: {
    /** The model identifier to use for generation. */
    readonly model: string;
    /** The conversation messages. */
    readonly messages: readonly LLMMessage[];
    /** Sampling temperature (0-2). Defaults to 0.7. */
    readonly temperature?: number;
    /** Maximum tokens to generate. */
    readonly max_tokens?: number;
    /** Response format constraint. */
    readonly response_format?: { readonly type: "json_object" | "text" };
  }): Promise<LLMResponse>;
}

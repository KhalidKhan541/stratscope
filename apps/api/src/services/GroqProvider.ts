import type { LLMProvider, LLMMessage, LLMResponse } from "./LLMProvider";

/**
 * Configuration for the Groq API provider.
 */
interface GroqConfig {
  /** The Groq API key. */
  readonly apiKey: string;
  /** Optional base URL override. Defaults to the Groq production endpoint. */
  readonly baseUrl?: string;
}

/**
 * Groq implementation of the LLMProvider interface.
 *
 * Uses the Groq Chat Completions API (OpenAI-compatible).
 */
export class GroqProvider implements LLMProvider {
  /** Provider identifier. */
  readonly name = "groq";

  private readonly apiKey: string;
  private readonly baseUrl: string;

  /**
   * Create a new GroqProvider.
   *
   * @param config - Configuration including API key and optional base URL.
   */
  constructor(config: GroqConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://api.groq.com/openai/v1";
  }

  /**
   * Generate a chat completion via the Groq API.
   *
   * @param params - Generation parameters.
   * @returns The LLM response with content, model, usage, and latency.
   * @throws If the Groq API returns a non-2xx response.
   */
  async generate(params: {
    /** The model identifier to use. */
    readonly model: string;
    /** The conversation messages. */
    readonly messages: readonly LLMMessage[];
    /** Sampling temperature. Defaults to 0.7. */
    readonly temperature?: number;
    /** Maximum tokens to generate. */
    readonly max_tokens?: number;
    /** Response format constraint. */
    readonly response_format?: { readonly type: "json_object" | "text" };
  }): Promise<LLMResponse> {
    const start = Date.now();

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.max_tokens,
        response_format: params.response_format,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: { content: string };
        finish_reason: string;
      }>;
      model: string;
      usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    };

    const latency_ms = Date.now() - start;
    const choice = data.choices[0];

    return {
      content: choice?.message?.content ?? "",
      model: data.model,
      usage: data.usage,
      finish_reason:
        (choice?.finish_reason as LLMResponse["finish_reason"]) ?? "unknown",
      latency_ms,
    };
  }
}

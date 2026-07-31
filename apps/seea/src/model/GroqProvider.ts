import type { LLMProvider, LLMRequest, LLMResponse } from "./LLMProvider.js";

export class GroqProvider implements LLMProvider {
  readonly name = "groq";
  private apiKey: string;
  private baseUrl: string;
  private maxRetries: number;

  constructor(apiKey: string, baseUrl: string = "https://api.groq.com/openai/v1", maxRetries: number = 3) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.maxRetries = maxRetries;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const start = Date.now();

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const backoffMs = 2 ** attempt * 5000;
        console.warn(`[GroqProvider] Retry ${attempt}/${this.maxRetries} after rate limit, waiting ${backoffMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          max_tokens: request.max_tokens ?? 4096,
          temperature: request.temperature ?? 0.7,
          top_p: request.top_p ?? 0.9,
        }),
      });

      if (response.ok) {
        const data = await response.json() as Record<string, unknown>;
        const choices = data.choices as Array<Record<string, unknown>> | undefined;
        const choice = choices?.[0];
        const usage = data.usage as Record<string, number> | undefined;
        const message = choice?.message as Record<string, unknown> | undefined;

        return {
          content: (message?.content as string) ?? "",
          model: (data.model as string) ?? request.model,
          tokens_used: usage?.total_tokens ?? 0,
          prompt_tokens: usage?.prompt_tokens ?? 0,
          completion_tokens: usage?.completion_tokens ?? 0,
          latency_ms: Date.now() - start,
          finish_reason: (choice?.finish_reason as string) ?? "unknown",
        };
      }

      const errorText = await response.text();
      const isRateLimit = response.status === 429 || response.status === 408 || response.status >= 500;
      lastError = new Error(`Groq API error: ${response.status} - ${errorText}`);

      if (!isRateLimit || attempt >= this.maxRetries) {
        throw lastError;
      }

      console.warn(`[GroqProvider] Rate limited (${response.status}), attempt ${attempt + 1}/${this.maxRetries}`);
    }

    throw lastError ?? new Error("Groq API error: unknown");
  }
}
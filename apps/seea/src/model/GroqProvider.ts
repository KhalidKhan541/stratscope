import type { LLMProvider, LLMRequest, LLMResponse } from "./LLMProvider.js";

export class GroqProvider implements LLMProvider {
  readonly name = "groq";
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = "https://api.groq.com/openai/v1") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const start = Date.now();

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

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${error}`);
    }

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
}
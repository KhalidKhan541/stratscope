import type { LLMProvider, LLMMessage, LLMRequest, LLMResponse } from "./LLMProvider.js";

export interface RouteConfig {
  readonly messages: readonly LLMMessage[];
  readonly model?: string;
  readonly temperature?: number;
  readonly max_tokens?: number;
  readonly top_p?: number;
}

export class ModelRouter {
  private providers: Map<string, LLMProvider>;
  private defaultModel: string;

  constructor(defaultModel: string) {
    this.providers = new Map();
    this.defaultModel = defaultModel;
  }

  registerProvider(name: string, provider: LLMProvider): void {
    this.providers.set(name, provider);
  }

  async route(config: RouteConfig): Promise<LLMResponse> {
    const model = config.model ?? this.defaultModel;
    const provider = this.findProvider(model);

    if (!provider) {
      throw new Error(`No provider registered for model: ${model}`);
    }

    const request: LLMRequest = {
      messages: config.messages,
      model,
      max_tokens: config.max_tokens,
      temperature: config.temperature,
      top_p: config.top_p,
    };

    return provider.complete(request);
  }

  private findProvider(model: string): LLMProvider | undefined {
    for (const [name, provider] of this.providers) {
      if (model.startsWith(name) || provider.name === name) {
        return provider;
      }
    }
    return this.providers.values().next().value;
  }
}

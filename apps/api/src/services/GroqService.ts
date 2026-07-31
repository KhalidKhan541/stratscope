import type { Env } from "../workers/env.js";
import type { LLMProvider, LLMMessage, LLMResponse } from "./LLMProvider.js";
import { GroqProvider } from "./GroqProvider.js";

export interface EvaluateParams {
  readonly task: string;
  readonly output: string;
  readonly tools_used: readonly string[];
  readonly errors: readonly string[];
}

export interface EvaluateResult {
  readonly score: number;
  readonly feedback: string;
  readonly suggestions: readonly string[];
}

export interface ReflectParams {
  readonly task: string;
  readonly output: string;
  readonly score: number;
  readonly errors: readonly string[];
}

export interface ReflectResult {
  readonly what_worked: readonly string[];
  readonly what_failed: readonly string[];
  readonly improvements: readonly string[];
}

export class GroqService {
  private readonly provider: LLMProvider;

  constructor(provider: LLMProvider) {
    this.provider = provider;
  }

  static fromEnv(env: Env): GroqService | null {
    const apiKey = env.GROQ_API_KEY;
    if (!apiKey) {
      return null;
    }
    const provider = new GroqProvider({ apiKey });
    return new GroqService(provider);
  }

  async generate(params: {
    readonly model: string;
    readonly messages: readonly LLMMessage[];
    readonly temperature?: number;
    readonly max_tokens?: number;
    readonly response_format?: { readonly type: "json_object" | "text" };
  }): Promise<LLMResponse> {
    return this.provider.generate(params);
  }

  async evaluateExecution(params: EvaluateParams): Promise<EvaluateResult> {
    const response = await this.provider.generate({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: [
            "You are an execution evaluator. Analyze the execution and provide:",
            "- score: 0-100 based on task completion, code quality, and efficiency",
            "- feedback: brief explanation of the score",
            "- suggestions: array of improvements",
            "",
            "Respond in JSON format: { \"score\": number, \"feedback\": string, \"suggestions\": string[] }",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            `Task: ${params.task}`,
            `Output: ${params.output}`,
            `Tools used: ${params.tools_used.join(", ")}`,
            `Errors:`,
            ...params.errors,
          ].join("\n"),
        },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    try {
      const parsed = JSON.parse(response.content) as Record<string, unknown>;
      return {
        score: typeof parsed["score"] === "number" ? parsed["score"] : 0,
        feedback: typeof parsed["feedback"] === "string" ? parsed["feedback"] : "No feedback",
        suggestions: Array.isArray(parsed["suggestions"]) ? parsed["suggestions"] as string[] : [],
      };
    } catch {
      return { score: 50, feedback: "Could not parse evaluation", suggestions: [] };
    }
  }

  async generateReflection(params: ReflectParams): Promise<ReflectResult> {
    const response = await this.provider.generate({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: [
            "You are a reflection agent. Analyze what happened and provide insights.",
            "",
            "Respond in JSON format: {",
            "  \"what_worked\": string[],",
            "  \"what_failed\": string[],",
            "  \"improvements\": string[]",
            "}",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            `Task: ${params.task}`,
            `Output: ${params.output}`,
            `Score: ${params.score}`,
            `Errors:`,
            ...params.errors,
          ].join("\n"),
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    try {
      const parsed = JSON.parse(response.content) as Record<string, unknown>;
      return {
        what_worked: Array.isArray(parsed["what_worked"]) ? parsed["what_worked"] as string[] : [],
        what_failed: Array.isArray(parsed["what_failed"]) ? parsed["what_failed"] as string[] : [],
        improvements: Array.isArray(parsed["improvements"]) ? parsed["improvements"] as string[] : [],
      };
    } catch {
      return {
        what_worked: [],
        what_failed: ["Could not parse reflection"],
        improvements: [],
      };
    }
  }
}

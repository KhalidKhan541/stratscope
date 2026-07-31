import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../workers/env.js";
import { validate } from "../../middleware/validate.js";
import { GroqService } from "../../services/GroqService.js";

const llm = new Hono<{ Bindings: Env }>();

const completeSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
    })
  ),
  model: z.string().optional(),
  max_tokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

const evaluateSchema = z.object({
  task: z.string().min(1),
  output: z.string().min(1),
  tools_used: z.array(z.string()),
  errors: z.array(z.string()),
});

const reflectSchema = z.object({
  task: z.string().min(1),
  output: z.string().min(1),
  score: z.number().min(0).max(100),
  errors: z.array(z.string()),
});

llm.post(
  "/complete",
  validate({ body: completeSchema }),
  async (c) => {
    const groq = GroqService.fromEnv(c.env);
    if (!groq) {
      return c.json(
        { error: { code: "CONFIGURATION_ERROR", message: "LLM provider not configured" } },
        500
      );
    }

    const body = c.req.valid("json") as z.infer<typeof completeSchema>;

    try {
      const response = await groq.generate({
        model: body.model ?? "llama-3.3-70b-versatile",
        messages: body.messages,
        max_tokens: body.max_tokens,
        temperature: body.temperature,
      });
      return c.json(response);
    } catch (error) {
      return c.json(
        {
          error: {
            code: "PROVIDER_ERROR",
            message: error instanceof Error ? error.message : "Unknown provider error",
          },
        },
        500
      );
    }
  }
);

llm.post(
  "/evaluate",
  validate({ body: evaluateSchema }),
  async (c) => {
    const groq = GroqService.fromEnv(c.env);
    if (!groq) {
      return c.json(
        { error: { code: "CONFIGURATION_ERROR", message: "LLM provider not configured" } },
        500
      );
    }

    const body = c.req.valid("json") as z.infer<typeof evaluateSchema>;

    try {
      const result = await groq.evaluateExecution(body);
      return c.json(result);
    } catch (error) {
      return c.json(
        {
          error: {
            code: "PROVIDER_ERROR",
            message: error instanceof Error ? error.message : "Unknown provider error",
          },
        },
        500
      );
    }
  }
);

llm.post(
  "/reflect",
  validate({ body: reflectSchema }),
  async (c) => {
    const groq = GroqService.fromEnv(c.env);
    if (!groq) {
      return c.json(
        { error: { code: "CONFIGURATION_ERROR", message: "LLM provider not configured" } },
        500
      );
    }

    const body = c.req.valid("json") as z.infer<typeof reflectSchema>;

    try {
      const result = await groq.generateReflection(body);
      return c.json(result);
    } catch (error) {
      return c.json(
        {
          error: {
            code: "PROVIDER_ERROR",
            message: error instanceof Error ? error.message : "Unknown provider error",
          },
        },
        500
      );
    }
  }
);

llm.get("/models", async (c) => {
  return c.json({
    models: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", provider: "groq" },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B", provider: "groq" },
      { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", provider: "groq" },
      { id: "gemma2-9b-it", name: "Gemma 2 9B", provider: "groq" },
    ],
  });
});

export { llm as llmRoutes };

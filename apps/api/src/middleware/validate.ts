/**
 * Request validation middleware using Zod.
 *
 * Validates request body, query parameters, and path parameters
 * against Zod schemas and returns structured validation errors.
 */

import type { Context, Next } from "hono";
import { ZodError, type ZodSchema, type ZodObject, type ZodRawShape } from "zod";

/**
 * Validation target for a schema.
 */
export type ValidationTarget = "json" | "query" | "param";

/**
 * Validation middleware options.
 */
export interface ValidationOptions {
  /** Schema for the JSON request body. */
  body?: ZodSchema;
  /** Schema for query parameters. */
  query?: ZodObject<ZodRawShape>;
  /** Schema for path parameters. */
  param?: ZodObject<ZodRawShape>;
}

/**
 * Formats a ZodError into a structured validation error response.
 */
function formatZodError(error: ZodError): {
  code: string;
  message: string;
  fieldErrors: Array<{ field: string; message: string }>;
} {
  const fieldErrors = error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));

  return {
    code: "VALIDATION_ERROR",
    message: `Validation failed for ${fieldErrors.length} field(s)`,
    fieldErrors,
  };
}

/**
 * Creates a validation middleware that validates the specified request parts.
 *
 * @example
 * ```ts
 * const createExecutionSchema = z.object({
 *   project_id: z.string().uuid(),
 *   agent_id: z.string().uuid().optional(),
 *   input: z.string(),
 * });
 *
 * app.post("/v1/executions", validate({ body: createExecutionSchema }), handler);
 * ```
 */
export function validate(schemas: ValidationOptions) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const errors: Array<{ field: string; message: string }> = [];

    // Validate JSON body
    if (schemas.body) {
      try {
        const body = await c.req.json();
        const result = schemas.body.safeParse(body);
        if (!result.success) {
          const formatted = formatZodError(result.error);
          errors.push(...formatted.fieldErrors);
        }
      } catch {
        errors.push({
          field: "body",
          message: "Invalid JSON body",
        });
      }
    }

    // Validate query parameters
    if (schemas.query) {
      const query = c.req.query();
      const result = schemas.query.safeParse(query);
      if (!result.success) {
        const formatted = formatZodError(result.error);
        errors.push(...formatted.fieldErrors);
      }
    }

    // Validate path parameters
    if (schemas.param) {
      const param = c.req.param();
      const result = schemas.param.safeParse(param);
      if (!result.success) {
        const formatted = formatZodError(result.error);
        errors.push(...formatted.fieldErrors);
      }
    }

    if (errors.length > 0) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: `Validation failed for ${errors.length} field(s)`,
            details: { fieldErrors: errors },
          },
        },
        400
      );
    }

    await next();
  };
}

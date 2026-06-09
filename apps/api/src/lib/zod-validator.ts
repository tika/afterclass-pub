/**
 * Custom zValidator that returns meaningful, user-friendly validation errors.
 *
 * Instead of raw Zod error format like:
 *   [{ "code": "invalid_format", "format": "url", "path": ["sourceUrl"], "message": "Invalid URL" }]
 *
 * Returns a structured response:
 *   { "message": "Validation failed", "errors": [{ "path": "sourceUrl", "message": "Invalid source URL" }] }
 *
 * @see https://medium.com/@kmcelada.software/how-to-return-meaningful-error-messages-with-zod-lambda-and-api-gateway-f43344f13f32
 */

import { zValidator as honoZValidator } from "@hono/zod-validator";

type ZodIssueLike = {
  path?: unknown[];
  message?: string;
};

type ZodErrorLike = {
  issues?: ZodIssueLike[];
  errors?: ZodIssueLike[];
};

function formatZodErrors(error: ZodErrorLike): Array<{ path: string; message: string }> {
  const issues = error.issues ?? error.errors ?? [];
  return issues.map((issue) => ({
    path: Array.isArray(issue.path) ? issue.path.map(String).join(".") : String(issue.path ?? ""),
    message: issue.message ?? "Invalid value",
  }));
}

/**
 * Wraps @hono/zod-validator with a hook that formats validation errors
 * into a user-friendly structure with path and message for each field.
 * Cast to typeof honoZValidator so Hono's validator chain inference works for c.req.valid().
 */
export const zValidator = ((
  target: Parameters<typeof honoZValidator>[0],
  schema: Parameters<typeof honoZValidator>[1],
  hook?: Parameters<typeof honoZValidator>[2],
  options?: Parameters<typeof honoZValidator>[3],
) => {
  const errorFormatHook = (
    result: unknown,
    c: { json: (body: unknown, status: number) => Response },
  ) => {
    const r = result as { success: boolean; error?: ZodErrorLike };
    if (!r.success && r.error) {
      const errors = formatZodErrors(r.error);
      const errorSummary = errors.map((e) => `${e.path}: ${e.message}`).join("; ");
      return c.json(
        {
          error: errorSummary,
          message: "Validation failed",
          errors,
        },
        400,
      );
    }
    if (typeof hook === "function") {
      return (hook as (a: unknown, b: unknown) => unknown)(result, c);
    }
  };
  return honoZValidator(
    target,
    schema,
    errorFormatHook as Parameters<typeof honoZValidator>[2],
    options,
  );
}) as typeof honoZValidator;

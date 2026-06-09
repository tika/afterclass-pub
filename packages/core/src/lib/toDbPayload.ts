import type { ZodObject, ZodRawShape, z } from "zod";

/**
 * Converts a Zod-validated input object into a database-compatible payload.
 * Transforms ISO datetime strings into Date objects for timestamp columns.
 */
export function toDbPayload<T extends ZodObject<ZodRawShape>>(
  data: Partial<z.infer<T>>,
  _schema: T,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;

    if (
      typeof value === "string" &&
      (key === "startTime" || key === "endTime") &&
      !Number.isNaN(Date.parse(value))
    ) {
      result[key] = new Date(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

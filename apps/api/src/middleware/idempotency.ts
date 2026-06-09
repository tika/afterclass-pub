import type { Context, Next } from "hono";

const IDEMPOTENCY_TTL = 60 * 60 * 24; // 24 hours

const MUTATION_METHODS = ["POST", "PATCH", "DELETE"];

/**
 * Idempotency middleware for mutation routes.
 * When client sends Idempotency-Key header, caches the response and returns it on duplicate requests.
 * Only applies to POST, PATCH, DELETE on /v1/* routes.
 */
export const idempotencyMiddleware = async (c: Context, next: Next) => {
  if (!MUTATION_METHODS.includes(c.req.method)) {
    await next();
    return;
  }

  const key = c.req.header("Idempotency-Key")?.trim();
  if (!key) {
    await next();
    return;
  }

  const redis = c.get("services").redis;
  const cacheKey = `idempotency:${key}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const { status, body } = JSON.parse(cached) as { status: number; body: unknown };
      return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch {
    // Redis error — proceed without idempotency
    await next();
    return;
  }

  await next();

  // Cache successful responses only (2xx)
  if (c.res.status < 200 || c.res.status >= 300) {
    return;
  }

  try {
    const status = c.res.status;
    const clone = c.res.clone();
    const text = await clone.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    await redis.set(cacheKey, JSON.stringify({ status, body }), {
      ex: IDEMPOTENCY_TTL,
    });
  } catch {
    // Non-fatal — idempotency cache write failed
  }
};

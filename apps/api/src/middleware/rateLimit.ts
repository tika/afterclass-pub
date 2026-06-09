import type { Context, Next } from "hono";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { HTTPException } from "hono/http-exception";

const redis =
  process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_URL,
        token: process.env.UPSTASH_REDIS_TOKEN,
      })
    : null;

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "1 m"),
      analytics: true,
    })
  : null;

function getClientIdentifier(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "anon";
  }
  const realIp = c.req.header("x-real-ip");
  if (realIp) return realIp;
  return "anon";
}

/**
 * Rate limit middleware for /v1/* API routes.
 * Uses sliding window: 100 requests per minute per client (IP).
 * Skips when Redis is not configured (e.g. local dev without Upstash).
 */
export const rateLimitMiddleware = async (c: Context, next: Next) => {
  if (!ratelimit) {
    await next();
    return;
  }

  const identifier = getClientIdentifier(c);
  const { success, limit, remaining, reset } = await ratelimit.limit(identifier);

  c.header("X-RateLimit-Limit", limit.toString());
  c.header("X-RateLimit-Remaining", remaining.toString());
  c.header("X-RateLimit-Reset", reset.toString());

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    throw new HTTPException(429, {
      message: "Too many requests. Please try again later.",
      res: new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
        status: 429,
        headers: { "Retry-After": retryAfter.toString(), "Content-Type": "application/json" },
      }),
    });
  }

  await next();
};

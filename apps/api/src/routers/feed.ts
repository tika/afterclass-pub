import { zValidator } from "@/lib/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppVariables } from "@/lib/types";
import { requireAuth } from "@/middleware/auth";
import { getFeedSchema, getMajorFeedSchema } from "@afterclass/core/schemas/feed";
import * as feedService from "@afterclass/core/services/feed";
import { logger } from "@afterclass/core/lib/logger";

// Chain routes to accumulate types for Hono RPC
const feedRouter = new Hono<{ Variables: AppVariables }>()
  .get("/", requireAuth, zValidator("query", getFeedSchema), async (c) => {
    const ctx = c.get("services");
    const { limit, offset } = c.req.valid("query");
    const events = await feedService.getFeed(ctx, {
      limit,
      offset,
    });
    return c.json({ events, limit, offset }, 200);
  })
  .get("/major", requireAuth, zValidator("query", getMajorFeedSchema), async (c) => {
    const ctx = c.get("services");
    const user = c.get("user")!;
    const { limit, offset } = c.req.valid("query");

    try {
      const result = await feedService.getMajorFeed(ctx, {
        userId: user.id,
        limit,
        offset,
      });
      return c.json({ ...result, limit, offset }, 200);
    } catch (err) {
      logger.error("Failed to get major feed", {
        userId: user.id,
        limit,
        offset,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      throw err;
    }
  })
  .get("/interests", requireAuth, zValidator("query", getMajorFeedSchema), async (c) => {
    const ctx = c.get("services");
    const user = c.get("user")!;
    const { limit, offset } = c.req.valid("query");

    try {
      const result = await feedService.getInterestsFeed(ctx, {
        userId: user.id,
        limit,
        offset,
      });
      return c.json({ ...result, limit, offset }, 200);
    } catch (err) {
      logger.error("Failed to get interests feed", {
        userId: user.id,
        limit,
        offset,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      throw err;
    }
  })
  .get(
    "/interest/:interest",
    requireAuth,
    zValidator("param", z.object({ interest: z.string().min(1) })),
    zValidator("query", getFeedSchema),
    async (c) => {
      const ctx = c.get("services");
      const { interest } = c.req.valid("param");
      const { limit, offset } = c.req.valid("query");
      const events = await feedService.getInterestFeed(ctx, {
        interest: decodeURIComponent(interest),
        limit,
        offset,
      });
      return c.json({ events, limit, offset }, 200);
    },
  );

export { feedRouter };

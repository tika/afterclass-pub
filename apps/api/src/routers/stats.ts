import { Hono } from "hono";
import type { AppVariables } from "@/lib/types";
import { requireAdmin } from "@/middleware/requireAdmin";
import * as statsService from "@afterclass/core/services/stats";

// Chain routes to accumulate types
const statsRouter = new Hono<{ Variables: AppVariables }>().get("/", requireAdmin, async (c) => {
  const ctx = c.get("services");
  const stats = await statsService.getStats(ctx);
  return c.json(stats, 200);
});

export { statsRouter };

import { zValidator } from "@/lib/zod-validator";
import { Hono } from "hono";
import type { AppVariables } from "@/lib/types";
import { requireAuth } from "@/middleware/auth";
import { requireAdmin } from "@/middleware/requireAdmin";
import {
  createPOISchema,
  deletePOISchema,
  getPOISchema,
  getPOIsSchema,
  updatePOISchema,
} from "@afterclass/core/schemas/pois";
import * as poisService from "@afterclass/core/services/pois";

// Chain routes to accumulate types for Hono RPC
// Note: admin routes must come before /:id routes to avoid path conflicts
const poisRouter = new Hono<{ Variables: AppVariables }>()
  .get("/", requireAuth, zValidator("query", getPOIsSchema), async (c) => {
    const ctx = c.get("services");
    const pois = await poisService.getPOIs(ctx);
    return c.json({ pois }, 200);
  })
  .get("/admin/all", requireAdmin, async (c) => {
    const ctx = c.get("services");
    const pois = await poisService.getAllPOIs(ctx);
    return c.json({ pois }, 200);
  })
  .post("/admin", requireAdmin, zValidator("json", createPOISchema), async (c) => {
    const ctx = c.get("services");
    const input = c.req.valid("json");
    const poi = await poisService.createPOI(ctx, input);
    return c.json({ poi }, 201);
  })
  .patch(
    "/admin/:id",
    requireAdmin,
    zValidator("param", getPOISchema),
    zValidator("json", updatePOISchema.omit({ id: true })),
    async (c) => {
      const ctx = c.get("services");
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const poi = await poisService.updatePOI(ctx, id, input);
      return c.json({ poi }, 200);
    },
  )
  .delete("/admin/:id", requireAdmin, zValidator("param", deletePOISchema), async (c) => {
    const ctx = c.get("services");
    const { id } = c.req.valid("param");
    await poisService.deletePOI(ctx, id);
    return c.json({ success: true }, 200);
  })
  .get("/:id", requireAuth, zValidator("param", getPOISchema), async (c) => {
    const ctx = c.get("services");
    const { id } = c.req.valid("param");
    const poi = await poisService.getPOI(ctx, id);
    return c.json({ poi }, 200);
  })
  .post("/", requireAuth, zValidator("json", createPOISchema), async (c) => {
    const ctx = c.get("services");
    const input = c.req.valid("json");
    const poi = await poisService.createPOI(ctx, input);
    return c.json({ poi }, 201);
  })
  .patch(
    "/:id",
    requireAuth,
    zValidator("param", getPOISchema),
    zValidator("json", updatePOISchema.omit({ id: true })),
    async (c) => {
      const ctx = c.get("services");
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const poi = await poisService.updatePOI(ctx, id, input);
      return c.json({ poi }, 200);
    },
  )
  .delete("/:id", requireAuth, zValidator("param", deletePOISchema), async (c) => {
    const ctx = c.get("services");
    const { id } = c.req.valid("param");
    await poisService.deletePOI(ctx, id);
    return c.json({ success: true }, 200);
  });

export { poisRouter };

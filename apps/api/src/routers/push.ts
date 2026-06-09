import { zValidator } from "@/lib/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppVariables } from "@/lib/types";
import { requireAuth } from "@/middleware/auth";
import { requireAdmin } from "@/middleware/requireAdmin";
import * as pushService from "@afterclass/core/services/push";

// Note: HTTPException not needed here - middleware handles auth errors

const deviceTokenSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

// Chain routes to accumulate types for Hono RPC
const pushRouter = new Hono<{ Variables: AppVariables }>()
  .post("/device-token", requireAuth, zValidator("json", deviceTokenSchema), async (c) => {
    const ctx = c.get("services");
    const user = c.get("user")!;
    const { token } = c.req.valid("json");

    await pushService.upsertDeviceToken(ctx, user.id, token);
    return c.json({ success: true }, 200);
  })
  .delete("/device-token", requireAuth, zValidator("json", deviceTokenSchema), async (c) => {
    const ctx = c.get("services");
    const user = c.get("user")!;
    const { token } = c.req.valid("json");

    await pushService.removeDeviceToken(ctx, user.id, token);
    return c.json({ success: true }, 200);
  })
  .get("/admin/device-tokens", requireAdmin, async (c) => {
    const ctx = c.get("services");
    const tokens = await pushService.getAllDeviceTokens(ctx);
    return c.json({ tokens }, 200);
  })
  .post(
    "/admin/send",
    requireAdmin,
    zValidator(
      "json",
      z.object({
        userId: z.uuid(),
        title: z.string().min(1),
        body: z.string().min(1),
        data: z.record(z.string(), z.string()).optional(),
      }),
    ),
    async (c) => {
      const ctx = c.get("services");
      const { userId, title, body, data } = c.req.valid("json");
      const result = await pushService.sendPushNotification(ctx, userId, {
        title,
        body,
        data,
      });
      return c.json({ success: true, ...result }, 200);
    },
  )
  .post(
    "/admin/broadcast",
    requireAdmin,
    zValidator(
      "json",
      z.object({
        title: z.string().min(1),
        body: z.string().min(1),
        data: z.record(z.string(), z.string()).optional(),
      }),
    ),
    async (c) => {
      const ctx = c.get("services");
      const { title, body, data } = c.req.valid("json");
      const result = await pushService.broadcastPushNotification(ctx, {
        title,
        body,
        data,
      });
      return c.json({ success: true, ...result }, 200);
    },
  );

export { pushRouter };

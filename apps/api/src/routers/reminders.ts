import { zValidator } from "@/lib/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { AppVariables } from "@/lib/types";
import { requireAuth } from "@/middleware/auth";
import * as remindersService from "@afterclass/core/services/reminders";

const reminderModeSchema = z.object({
  mode: z.enum(["simple", "adaptive"]),
});

const scheduleNotificationsSchema = z.object({
  notificationTimes: z.array(z.string().datetime()),
});

// Chain routes to accumulate types for Hono RPC
const remindersRouter = new Hono<{ Variables: AppVariables }>()
  .post(
    "/events/:eventId",
    requireAuth,
    zValidator("param", z.object({ eventId: z.uuid() })),
    zValidator("json", reminderModeSchema),
    async (c) => {
      const ctx = c.get("services");
      const user = c.get("user")!;
      const { eventId } = c.req.valid("param");
      const { mode: _mode } = c.req.valid("json");
      void _mode;

      const reminder = await remindersService.createReminder(ctx, user.id, eventId);

      return c.json({ success: true, reminder }, 201);
    },
  )
  .delete(
    "/events/:eventId",
    requireAuth,
    zValidator("param", z.object({ eventId: z.uuid() })),
    async (c) => {
      const ctx = c.get("services");
      const user = c.get("user")!;
      const { eventId } = c.req.valid("param");

      try {
        await remindersService.deleteReminder(ctx, user.id, eventId);
        return c.json({ success: true }, 200);
      } catch (error) {
        throw new HTTPException(404, {
          message: error instanceof Error ? error.message : "Failed to delete reminder",
        });
      }
    },
  )
  .get("/", requireAuth, async (c) => {
    const ctx = c.get("services");
    const user = c.get("user")!;
    const reminders = await remindersService.getUserReminders(ctx, user.id);

    return c.json({ reminders }, 200);
  })
  .get(
    "/events/:eventId",
    requireAuth,
    zValidator("param", z.object({ eventId: z.uuid() })),
    async (c) => {
      const ctx = c.get("services");
      const user = c.get("user")!;
      const { eventId } = c.req.valid("param");
      const reminder = await remindersService.hasReminder(ctx, user.id, eventId);

      return c.json({ hasReminder: !!reminder, reminder }, 200);
    },
  )
  .post(
    "/events/:eventId/schedule",
    requireAuth,
    zValidator("param", z.object({ eventId: z.uuid() })),
    zValidator("json", scheduleNotificationsSchema),
    async (c) => {
      const ctx = c.get("services");
      const user = c.get("user")!;
      const { eventId } = c.req.valid("param");
      const { notificationTimes } = c.req.valid("json");

      const times = notificationTimes.map((t) => new Date(t));
      const notifications = await remindersService.createScheduledNotifications(
        ctx,
        user.id,
        eventId,
        times,
      );

      return c.json({ success: true, notifications }, 201);
    },
  )
  .patch(
    "/notifications/:notificationId/delivered",
    requireAuth,
    zValidator("param", z.object({ notificationId: z.uuid() })),
    async (c) => {
      const ctx = c.get("services");
      const _user = c.get("user")!;
      const { notificationId } = c.req.valid("param");

      try {
        const notification = await remindersService.markNotificationDelivered(ctx, notificationId);
        return c.json({ success: true, notification }, 200);
      } catch (error) {
        throw new HTTPException(404, {
          message:
            error instanceof Error ? error.message : "Failed to mark notification as delivered",
        });
      }
    },
  )
  .get(
    "/stats/events/:eventId",
    requireAuth,
    zValidator("param", z.object({ eventId: z.uuid() })),
    async (c) => {
      const ctx = c.get("services");
      const { eventId } = c.req.valid("param");

      const stats = await remindersService.getEventNotificationStats(ctx, eventId);

      return c.json({ stats }, 200);
    },
  );

export { remindersRouter };

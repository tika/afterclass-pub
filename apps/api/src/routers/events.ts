import { zValidator } from "@/lib/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { isSuperAdmin } from "@afterclass/core/lib/constants";
import type { AppVariables } from "@/lib/types";
import { requireAuth } from "@/middleware/auth";
import { requireAdmin } from "@/middleware/requireAdmin";
import { requireGroupAdmin } from "@/middleware/requireGroupAdmin";
import {
  bulkDeleteEventsSchema,
  bulkUpdateEventStatusSchema,
  createEventSchema,
  getEventSchema,
  getEventsSchema,
  updateEventSchema,
} from "@afterclass/core/schemas/events";
import * as eventsService from "@afterclass/core/services/events";

// Chain routes to accumulate types for Hono RPC
const eventsRouter = new Hono<{ Variables: AppVariables }>()
  .get(
    "/public/by-pid/:publicId",
    zValidator("param", z.object({ publicId: z.string().min(1) })),
    async (c) => {
      const ctx = c.get("services");
      const { publicId } = c.req.valid("param");
      const result = await eventsService.getEventByPublicId(ctx, publicId);
      if (!result || result.event.status !== "PUBLISHED") {
        throw new HTTPException(404, { message: "Event not found" });
      }
      return c.json(result, 200);
    },
  )
  .get("/public/:id", zValidator("param", getEventSchema), async (c) => {
    const ctx = c.get("services");
    const { id } = c.req.valid("param");
    try {
      const result = await eventsService.getEvent(ctx, id);
      console.log(`[/public/:id] Event fetched: ${id}`, {
        eventId: result.event.id,
        title: result.event.title,
        status: result.event.status,
      });
      if (result.event.status !== "PUBLISHED") {
        console.warn(`[/public/:id] Event not published: ${id} has status ${result.event.status}`);
        throw new HTTPException(404, { message: "Event not found" });
      }
      return c.json(result, 200);
    } catch (error) {
      console.error(`[/public/:id] Error fetching event ${id}:`, error);
      if (error instanceof HTTPException) {
        throw error;
      }
      throw new HTTPException(500, { message: "Failed to fetch event" });
    }
  })
  .get("/future", requireAuth, zValidator("query", getEventsSchema), async (c) => {
    const ctx = c.get("services");
    const input = c.req.valid("query");
    const eventsData = await eventsService.getFutureEvents(ctx, {
      limit: input.limit,
      offset: input.offset,
    });
    return c.json(
      {
        events: eventsData,
        limit: input.limit,
        offset: input.offset,
      },
      200,
    );
  })
  .get("/:id", requireAuth, zValidator("param", getEventSchema), async (c) => {
    const ctx = c.get("services");
    const { id } = c.req.valid("param");
    const event = await eventsService.getEvent(ctx, id);
    return c.json(event, 200);
  })
  .get(
    "/location/:locationName",
    requireAuth,
    zValidator(
      "param",
      z.object({
        locationName: z.string().min(1, "Location name is required"),
      }),
    ),
    zValidator(
      "query",
      z.object({
        start_time: z.string().datetime().optional(),
        end_time: z.string().datetime().optional(),
      }),
    ),
    async (c) => {
      const ctx = c.get("services");
      const { locationName } = c.req.valid("param");
      const options = c.req.valid("query");
      const events = await eventsService.getEventsByLocation(ctx, locationName, options);
      return c.json({ events }, 200);
    },
  )
  .get(
    "/admin/all",
    requireAdmin,
    zValidator(
      "query",
      z.object({
        status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED", "ARCHIVED"]).optional(),
      }),
    ),
    async (c) => {
      const ctx = c.get("services");
      const { status } = c.req.valid("query");
      const events = await eventsService.getAllEvents(ctx, { status });
      return c.json({ events }, 200);
    },
  )
  .get(
    "/group/:groupId",
    requireGroupAdmin,
    zValidator(
      "param",
      z.object({
        groupId: z.uuid("Invalid group ID"),
      }),
    ),
    zValidator(
      "query",
      z.object({
        status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED", "ARCHIVED"]).optional(),
        upcoming: z.coerce.boolean().optional(),
        limit: z.coerce.number().int().positive().max(100).optional().default(50),
        offset: z.coerce.number().int().nonnegative().optional().default(0),
      }),
    ),
    async (c) => {
      const ctx = c.get("services");
      const { groupId } = c.req.valid("param");
      const query = c.req.valid("query");
      const events = await eventsService.getGroupEvents(ctx, groupId, {
        status: query.status,
        upcoming: query.upcoming,
        limit: query.limit,
        offset: query.offset,
      });
      return c.json({ events }, 200);
    },
  )
  .post("/", requireAuth, zValidator("json", createEventSchema), async (c) => {
    const ctx = c.get("services");
    const user = c.get("user")!;
    const input = c.req.valid("json");

    const checkGroupAdmin = !isSuperAdmin(user.email);

    const event = await eventsService.createEvent(ctx, input, user.id, checkGroupAdmin);
    return c.json({ success: true, event }, 201);
  })
  .patch(
    "/:id",
    requireAuth,
    zValidator("param", getEventSchema),
    zValidator("json", updateEventSchema.omit({ id: true })),
    async (c) => {
      const ctx = c.get("services");
      const user = c.get("user")!;
      const { id } = c.req.valid("param");
      const data = c.req.valid("json");

      const checkGroupAdmin = !isSuperAdmin(user.email);

      const event = await eventsService.updateEvent(ctx, id, data, user.id, checkGroupAdmin);
      return c.json({ success: true, event }, 200);
    },
  )
  .delete("/:id", requireAuth, zValidator("param", getEventSchema), async (c) => {
    const ctx = c.get("services");
    const user = c.get("user")!;
    const { id } = c.req.valid("param");

    const checkGroupAdmin = !isSuperAdmin(user.email);

    await eventsService.deleteEvent(ctx, id, user.id, checkGroupAdmin);
    return c.json({ success: true }, 200);
  })
  .get("/:id/attendees", requireAdmin, zValidator("param", getEventSchema), async (c) => {
    const ctx = c.get("services");
    const { id } = c.req.valid("param");
    const attendees = await eventsService.getEventAttendees(ctx, id);
    return c.json(attendees, 200);
  })
  .post(
    "/admin/bulk-delete",
    requireAdmin,
    zValidator("json", bulkDeleteEventsSchema),
    async (c) => {
      const ctx = c.get("services");
      const user = c.get("user")!;
      const { eventIds } = c.req.valid("json");
      const result = await eventsService.bulkDeleteEvents(ctx, eventIds, user.id);
      return c.json({ success: true, ...result }, 200);
    },
  )
  .post(
    "/admin/bulk-update",
    requireAdmin,
    zValidator("json", bulkUpdateEventStatusSchema),
    async (c) => {
      const ctx = c.get("services");
      const user = c.get("user")!;
      const { eventIds, status } = c.req.valid("json");
      const result = await eventsService.bulkUpdateEventStatus(ctx, eventIds, status, user.id);
      return c.json({ success: true, ...result }, 200);
    },
  );

export { eventsRouter };

import { and, asc, count, desc, eq, gte, inArray, lte } from "drizzle-orm";
import type { z } from "zod";
import { generatePublicId } from "@afterclass/core/lib/slug";
import { createEventSchema, updateEventSchema } from "@afterclass/core/schemas/events";

type CreateEventInput = z.infer<typeof createEventSchema>;
type UpdateEventInput = Omit<z.infer<typeof updateEventSchema>, "id">;
import type { ServiceContext } from "./context";
import {
  eventPublicColumns,
  eventReminders,
  events,
  groupPublicColumns,
  groups,
} from "@afterclass/core/db/schema";
import { eventBus } from "@afterclass/core/events";
import type {
  EventCreated,
  EventDeleted,
  EventUpdated,
} from "@afterclass/core/schemas/domain-events";
import { promoteDraftFlyers } from "@afterclass/core/lib/s3";
import { toDbPayload } from "@afterclass/core/lib/toDbPayload";
import { generateEventEmbedding } from "./embeddings";
import { isGroupAdmin } from "./groups";

export const getFutureEvents = async (
  ctx: ServiceContext,
  options: { limit?: number; offset?: number },
) => {
  const limit = options.limit || 50;
  const offset = options.offset || 0;
  const now = new Date();

  return await ctx.db
    .select({
      event: eventPublicColumns,
      group: groupPublicColumns,
    })
    .from(events)
    .leftJoin(groups, eq(events.groupId, groups.id))
    .where(gte(events.startTime, now))
    .orderBy(asc(events.startTime))
    .limit(limit)
    .offset(offset);
};

export const getEvent = async (ctx: ServiceContext, eventId: string) => {
  const event = await ctx.db
    .select({
      event: eventPublicColumns,
      group: groupPublicColumns,
    })
    .from(events)
    .leftJoin(groups, eq(events.groupId, groups.id))
    .where(eq(events.id, eventId))
    .limit(1);

  if (event.length === 0) {
    throw new Error("Event not found");
  }

  return event[0];
};

export const getEventByPublicId = async (ctx: ServiceContext, publicId: string) => {
  const result = await ctx.db
    .select({
      event: eventPublicColumns,
      group: groupPublicColumns,
    })
    .from(events)
    .leftJoin(groups, eq(events.groupId, groups.id))
    .where(eq(events.publicId, publicId))
    .limit(1);

  if (result.length === 0) {
    throw new Error("Event not found");
  }

  return result[0];
};

export const getEventsByLocation = async (
  ctx: ServiceContext,
  locationName: string,
  options: {
    start_time?: string;
    end_time?: string;
  },
) => {
  const conditions = [eq(events.locationName, locationName)];

  if (options.start_time) {
    conditions.push(gte(events.startTime, new Date(options.start_time)));
  }

  if (options.end_time && events.endTime) {
    conditions.push(lte(events.endTime, new Date(options.end_time)));
  }

  return await ctx.db
    .select({
      event: eventPublicColumns,
      group: groupPublicColumns,
    })
    .from(events)
    .leftJoin(groups, eq(events.groupId, groups.id))
    .where(and(...conditions))
    .orderBy(events.startTime);
};

export const createEvent = async (
  ctx: ServiceContext,
  data: CreateEventInput,
  adminUserId: string,
  checkGroupAdmin: boolean = false,
) => {
  // Validate flyerImages has at least 1 item
  if (!data.flyerImages || data.flyerImages.length === 0) {
    throw new Error("At least one flyer image is required");
  }

  // If checkGroupAdmin is true, verify user is admin of the group
  if (checkGroupAdmin) {
    const isAdmin = await isGroupAdmin(ctx, data.groupId, adminUserId);
    if (!isAdmin) {
      throw new Error("Only group admins can create events for this group");
    }
  }
  const status = data.status || "DRAFT";

  let publicId: string;
  while (true) {
    publicId = generatePublicId(8);
    const existing = await ctx.db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.publicId, publicId))
      .limit(1);
    if (existing.length === 0) break;
  }

  const result = await ctx.db
    .insert(events)
    .values({
      title: data.title,
      description: data.description,
      flyerImages: data.flyerImages,
      startTime: new Date(data.startTime),
      endTime: data.endTime ? new Date(data.endTime) : undefined,
      locationName: data.locationName,
      address: data.address,
      lat: data.lat,
      lng: data.lng,
      status,
      sourceUrl: data.sourceUrl,
      metadata: data.metadata,
      groupId: data.groupId,
      publicId,
    })
    .returning();

  if (result.length === 0 || !result[0]) {
    throw new Error("Failed to create event");
  }

  // If publishing immediately, promote staging flyer URLs to the public path
  if (status === "PUBLISHED") {
    const promoted = await promoteDraftFlyers(result[0].id, data.flyerImages);
    await ctx.db.update(events).set({ flyerImages: promoted }).where(eq(events.id, result[0].id));
    result[0].flyerImages = promoted;
  }

  try {
    const embedding = await generateEventEmbedding(ctx, result[0]);
    await ctx.db.update(events).set({ embedding }).where(eq(events.id, result[0].id));
  } catch {
    // Non-fatal: embedding generation can fail (e.g., no API key)
  }

  // Publish EventCreated eventF
  await eventBus.emit<EventCreated>({
    type: "EventCreated",
    payload: {
      eventId: result[0].id,
      groupId: data.groupId,
      createdBy: adminUserId,
    },
  });

  const { embedding: _e, ...eventPublic } = result[0];
  return eventPublic;
};

export const updateEvent = async (
  ctx: ServiceContext,
  eventId: string,
  data: UpdateEventInput,
  adminUserId: string,
  checkGroupAdmin: boolean = false,
) => {
  // Phase 1: Fail-Fast Validation
  // Move this to the top so we don't hit the database if the input is already invalid
  if (data.flyerImages !== undefined && data.flyerImages.length === 0) {
    throw new Error("At least one flyer image is required");
  }

  const isPublishing = data.status === "PUBLISHED";

  // Phase 2: Authorization & Data Fetching
  let existingEvent: typeof events.$inferSelect | null = null;

  if (checkGroupAdmin || isPublishing) {
    const [event] = await ctx.db.select().from(events).where(eq(events.id, eventId)).limit(1);

    if (!event) throw new Error("Event not found");
    existingEvent = event;

    if (checkGroupAdmin) {
      const groupIdToCheck = data.groupId ?? event.groupId;
      const isAdmin = await isGroupAdmin(ctx, groupIdToCheck, adminUserId);
      if (!isAdmin) {
        throw new Error("Only group admins can update events for this group");
      }
    }
  }

  // Phase 3: Data Preparation
  if (isPublishing && existingEvent) {
    const flyerUrls = data.flyerImages ?? existingEvent.flyerImages ?? [];
    if (flyerUrls.length > 0) {
      data.flyerImages = await promoteDraftFlyers(eventId, flyerUrls);
    }
  }

  // Phase 4: Database Update
  const [updatedEvent] = await ctx.db
    .update(events)
    .set(toDbPayload(data, updateEventSchema))
    .where(eq(events.id, eventId))
    .returning();

  if (!updatedEvent) {
    throw new Error("Event not found");
  }

  // Phase 5: Side Effects (Event Bus & Embeddings)
  const changedFields = Object.keys(data).filter(
    (key) => (data as Record<string, unknown>)[key] !== undefined,
  );
  await eventBus.emit<EventUpdated>({
    type: "EventUpdated",
    payload: { eventId, updatedBy: adminUserId, changedFields },
  });

  // Phase 6: Return
  const { embedding: _e, ...eventPublic } = updatedEvent;
  return eventPublic;
};

export const deleteEvent = async (
  ctx: ServiceContext,
  eventId: string,
  adminUserId: string,
  checkGroupAdmin: boolean = false,
) => {
  // If checkGroupAdmin is true, verify user is admin of the event's group
  if (checkGroupAdmin) {
    const [event] = await ctx.db.select().from(events).where(eq(events.id, eventId)).limit(1);

    if (!event) {
      throw new Error("Event not found");
    }

    const isAdmin = await isGroupAdmin(ctx, event.groupId, adminUserId);
    if (!isAdmin) {
      throw new Error("Only group admins can delete events for this group");
    }
  }
  const result = await ctx.db.delete(events).where(eq(events.id, eventId)).returning();

  if (result.length === 0) {
    throw new Error("Event not found");
  }

  // Publish EventDeleted event
  await eventBus.emit<EventDeleted>({
    type: "EventDeleted",
    payload: {
      eventId,
      deletedBy: adminUserId,
    },
  });

  const { embedding: _e, ...eventPublic } = result[0];
  return eventPublic;
};

export const getAllEvents = async (
  ctx: ServiceContext,
  options?: {
    status?: "DRAFT" | "PUBLISHED" | "CANCELLED" | "ARCHIVED";
  },
) => {
  const conditions = options?.status ? [eq(events.status, options.status)] : [];

  const query = ctx.db
    .select({
      event: eventPublicColumns,
      group: groupPublicColumns,
    })
    .from(events)
    .leftJoin(groups, eq(events.groupId, groups.id));

  const result = conditions.length > 0 ? await query.where(and(...conditions)) : await query;

  // For draft events, sort by createdAt desc (newest first); otherwise by startTime desc
  const sorted = [...result].sort((a, b) => {
    if (options?.status === "DRAFT") {
      const aVal = new Date(a.event.createdAt).getTime();
      const bVal = new Date(b.event.createdAt).getTime();
      return bVal - aVal; // newest first
    }
    const aVal = new Date(a.event.startTime).getTime();
    const bVal = new Date(b.event.startTime).getTime();
    return bVal - aVal; // desc by startTime
  });
  return sorted;
};

export const getGroupEvents = async (
  ctx: ServiceContext,
  groupId: string,
  options: {
    status?: "DRAFT" | "PUBLISHED" | "CANCELLED" | "ARCHIVED";
    upcoming?: boolean; // true for upcoming, false for past
    limit?: number;
    offset?: number;
  } = {},
) => {
  const { status, upcoming, limit = 50, offset = 0 } = options;
  const now = new Date();

  const conditions = [eq(events.groupId, groupId)];

  if (status) {
    conditions.push(eq(events.status, status));
  }

  if (upcoming !== undefined) {
    if (upcoming) {
      conditions.push(gte(events.startTime, now));
    } else {
      conditions.push(lte(events.startTime, now));
    }
  }

  const query = ctx.db
    .select({
      event: eventPublicColumns,
      group: groupPublicColumns,
    })
    .from(events)
    .leftJoin(groups, eq(events.groupId, groups.id))
    .where(and(...conditions));

  if (upcoming) {
    return await query.orderBy(asc(events.startTime)).limit(limit).offset(offset);
  }

  return await query.orderBy(desc(events.startTime)).limit(limit).offset(offset);
};

export const getEventAttendees = async (ctx: ServiceContext, eventId: string) => {
  const attendeesResult = await ctx.db
    .select({ count: count() })
    .from(eventReminders)
    .where(eq(eventReminders.eventId, eventId));

  const attendeeCount = attendeesResult[0]?.count || 0;

  return {
    eventId,
    attendeeCount,
  };
};

export const bulkDeleteEvents = async (
  ctx: ServiceContext,
  eventIds: string[],
  adminUserId: string,
) => {
  if (eventIds.length === 0) {
    throw new Error("No event IDs provided");
  }

  const result = await ctx.db.delete(events).where(inArray(events.id, eventIds)).returning();

  // Publish EventDeleted events for each deleted event
  for (const event of result) {
    await eventBus.emit<EventDeleted>({
      type: "EventDeleted",
      payload: {
        eventId: event.id,
        deletedBy: adminUserId,
      },
    });
  }

  return { deletedCount: result.length, events: result };
};

export const bulkUpdateEventStatus = async (
  ctx: ServiceContext,
  eventIds: string[],
  status: "DRAFT" | "PUBLISHED" | "CANCELLED" | "ARCHIVED",
  adminUserId: string,
) => {
  if (eventIds.length === 0) {
    throw new Error("No event IDs provided");
  }

  // If publishing, promote draft flyer URLs for each event
  if (status === "PUBLISHED") {
    const existingEvents = await ctx.db
      .select({ id: events.id, flyerImages: events.flyerImages })
      .from(events)
      .where(inArray(events.id, eventIds));

    for (const event of existingEvents) {
      if (event.flyerImages && event.flyerImages.length > 0) {
        const publicUrls = await promoteDraftFlyers(event.id, event.flyerImages);
        await ctx.db.update(events).set({ flyerImages: publicUrls }).where(eq(events.id, event.id));
      }
    }
  }

  const result = await ctx.db
    .update(events)
    .set({ status })
    .where(inArray(events.id, eventIds))
    .returning();

  // Publish EventUpdated events for each updated event
  for (const event of result) {
    await eventBus.emit<EventUpdated>({
      type: "EventUpdated",
      payload: {
        eventId: event.id,
        updatedBy: adminUserId,
      },
    });
  }

  return { updatedCount: result.length, events: result };
};

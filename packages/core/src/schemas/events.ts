import { z } from "zod";

export const eventStatusSchema = z.enum(["DRAFT", "PUBLISHED", "CANCELLED", "ARCHIVED"]);

export const getEventsSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

export const getEventSchema = z.object({
  id: z.uuid("Invalid event ID"),
});

export const createEventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  flyerImages: z
    .array(z.url("Invalid flyer image URL"))
    .min(1, "At least one flyer image is required")
    .max(3),
  startTime: z.iso.datetime({ offset: true, error: "Invalid start time" }),
  endTime: z.iso.datetime({ offset: true, error: "Invalid end time" }).optional(),
  locationName: z.string().min(1, "Location name is required"),
  address: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  status: eventStatusSchema.optional(),
  sourceUrl: z.url("Invalid source URL").optional(),
  aiSummary: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  groupId: z.uuid("Invalid group ID"),
});

export const updateEventSchema = z.object({
  id: z.uuid("Invalid event ID"),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  flyerImages: z.array(z.url()).min(1, "At least one flyer image is required").max(3).optional(),
  startTime: z.iso.datetime({ offset: true }).optional(),
  endTime: z.iso.datetime({ offset: true }).optional(),
  locationName: z.string().min(1).optional(),
  address: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  status: eventStatusSchema.optional(),
  sourceUrl: z.url().optional(),
  aiSummary: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  groupId: z.uuid().optional(),
});

export const deleteEventSchema = z.object({
  id: z.uuid("Invalid event ID"),
});

export const eventResponseSchema = z.object({
  id: z.uuid(),
  publicId: z.string().nullable(),
  createdAt: z.coerce.string(),
  updatedAt: z.coerce.string(),
  title: z.string(),
  description: z.string().nullable(),
  flyerImages: z.array(z.string()),
  startTime: z.coerce.string(),
  endTime: z.coerce.string().nullable(),
  locationName: z.string(),
  locationDetail: z.string().nullable(),
  address: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  status: eventStatusSchema,
  sourceUrl: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  groupId: z.uuid(),
});

export const bulkDeleteEventsSchema = z.object({
  eventIds: z.array(z.uuid("Invalid event ID")).min(1),
});

export const bulkUpdateEventStatusSchema = z.object({
  eventIds: z.array(z.uuid("Invalid event ID")).min(1),
  status: eventStatusSchema,
});

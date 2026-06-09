import { z } from "zod";
import { eventResponseSchema } from "./events";
import { groupResponseSchema } from "./groups";

export const getMajorFeedSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

export const getFeedSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

export const feedEventSchema = z.object({
  event: eventResponseSchema,
  group: groupResponseSchema.nullable(),
});

export const feedResponseSchema = z.object({
  events: z.array(feedEventSchema),
  limit: z.number(),
  offset: z.number(),
});

import { z } from "zod";

export const getMapEventsSchema = z.object({
  filter: z.enum(["now", "today", "week"]).default("today"),
  ne_lat: z.coerce.number().min(-90).max(90).optional(),
  ne_lng: z.coerce.number().min(-180).max(180).optional(),
  sw_lat: z.coerce.number().min(-90).max(90).optional(),
  sw_lng: z.coerce.number().min(-180).max(180).optional(),
});

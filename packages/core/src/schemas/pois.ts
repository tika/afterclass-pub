import { z } from "zod";

export const getPOIsSchema = z.object({});

export const getPOISchema = z.object({
  id: z.uuid("Invalid POI ID"),
});

export const createPOISchema = z.object({
  name: z.string().min(1, "Name is required"),
  aliases: z.array(z.string()).optional(),
  address: z.string().optional(),
  lat: z.number().min(-90).max(90, "Latitude must be between -90 and 90"),
  lng: z.number().min(-180).max(180, "Longitude must be between -180 and 180"),
});

export const updatePOISchema = z.object({
  id: z.uuid("Invalid POI ID"),
  name: z.string().min(1).optional(),
  aliases: z.array(z.string()).optional().nullable(),
  address: z.string().optional().nullable(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export const deletePOISchema = z.object({
  id: z.uuid("Invalid POI ID"),
});

export const poiResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  aliases: z.array(z.string()).nullable(),
  address: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

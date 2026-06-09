import { desc, eq } from "drizzle-orm";
import type { ServiceContext } from "./context";
import { pointsOfInterest } from "@afterclass/core/db/schema";
import type { POI } from "@afterclass/core/types";

interface CreatePOIInput {
  name: string;
  aliases?: string[] | null;
  address?: string | null;
  lat: number;
  lng: number;
}

interface UpdatePOIInput {
  name?: string;
  aliases?: string[] | null;
  address?: string | null;
  lat?: number;
  lng?: number;
}

export const getPOIs = async (ctx: ServiceContext) => {
  return await ctx.db.select().from(pointsOfInterest).orderBy(desc(pointsOfInterest.createdAt));
};

// Admin only
export const getAllPOIs = async (ctx: ServiceContext) => {
  return await ctx.db.select().from(pointsOfInterest).orderBy(desc(pointsOfInterest.createdAt));
};

export const getPOI = async (ctx: ServiceContext, poiId: string) => {
  const [poi] = await ctx.db
    .select()
    .from(pointsOfInterest)
    .where(eq(pointsOfInterest.id, poiId))
    .limit(1);

  if (!poi) {
    throw new Error("POI not found");
  }

  return poi;
};

export const createPOI = async (ctx: ServiceContext, input: CreatePOIInput): Promise<POI> => {
  const [poi] = await ctx.db
    .insert(pointsOfInterest)
    .values({
      name: input.name,
      aliases: input.aliases || [],
      address: input.address || null,
      lat: input.lat,
      lng: input.lng,
    })
    .returning();

  if (!poi) {
    throw new Error("Failed to create POI");
  }

  return poi as unknown as POI;
};

export const updatePOI = async (
  ctx: ServiceContext,
  poiId: string,
  input: UpdatePOIInput,
): Promise<POI> => {
  const [poi] = await ctx.db
    .update(pointsOfInterest)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.aliases !== undefined && { aliases: input.aliases }),
      ...(input.address !== undefined && { address: input.address }),
      ...(input.lat !== undefined && { lat: input.lat }),
      ...(input.lng !== undefined && { lng: input.lng }),
      updatedAt: new Date(),
    })
    .where(eq(pointsOfInterest.id, poiId))
    .returning();

  if (!poi) {
    throw new Error("POI not found");
  }

  return poi as unknown as POI;
};

export const deletePOI = async (ctx: ServiceContext, poiId: string): Promise<void> => {
  await ctx.db.delete(pointsOfInterest).where(eq(pointsOfInterest.id, poiId));
};

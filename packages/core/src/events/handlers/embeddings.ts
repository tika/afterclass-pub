import { eq } from "drizzle-orm";
import { eventBus } from "@afterclass/core/events";
import type { EventUpdated, GroupUpdated } from "@afterclass/core/schemas/domain-events";
import { events, groups } from "@afterclass/core/db/schema";
import {
  generateEventEmbedding,
  generateGroupEmbedding,
} from "@afterclass/core/services/embeddings";

/**
 * Event handlers for regenerating embeddings on content changes
 */
export const registerEmbeddingHandlers = () => {
  /**
   * When an event is updated and title/description changed, regenerate embedding
   */
  eventBus.on<EventUpdated>("EventUpdated", async (event, ctx) => {
    const { eventId, changedFields } = event.payload;

    if (!changedFields || changedFields.length === 0) return;

    const embeddableFields = ["title", "description"];
    const needsRegeneration = changedFields.some((f) => embeddableFields.includes(f));
    if (!needsRegeneration) return;

    try {
      const [eventRecord] = await ctx.db
        .select()
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1);

      if (!eventRecord) return;

      const embedding = await generateEventEmbedding(ctx, eventRecord);
      await ctx.db.update(events).set({ embedding }).where(eq(events.id, eventId));

      console.log(`[EmbeddingHandler] Regenerated embedding for event ${eventId}`);
    } catch (error) {
      console.error(`[EmbeddingHandler] Failed to regenerate event embedding:`, error);
    }
  });

  /**
   * When a group is updated and name/bio/categories changed, regenerate embedding
   */
  eventBus.on<GroupUpdated>("GroupUpdated", async (event, ctx) => {
    const { groupId, changedFields } = event.payload;

    if (!changedFields || changedFields.length === 0) return;

    const embeddableFields = ["name", "bio", "categories"];
    const needsRegeneration = changedFields.some((f) => embeddableFields.includes(f));
    if (!needsRegeneration) return;

    try {
      const [groupRecord] = await ctx.db
        .select()
        .from(groups)
        .where(eq(groups.id, groupId))
        .limit(1);

      if (!groupRecord) return;

      const embedding = await generateGroupEmbedding(ctx, groupRecord);
      await ctx.db.update(groups).set({ embedding }).where(eq(groups.id, groupId));

      console.log(`[EmbeddingHandler] Regenerated embedding for group ${groupId}`);
    } catch (error) {
      console.error(`[EmbeddingHandler] Failed to regenerate group embedding:`, error);
    }
  });
};

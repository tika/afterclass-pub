import { and, eq } from "drizzle-orm";
import { eventBus } from "@afterclass/core/events";
import type { EventDeleted, GroupDeleted } from "@afterclass/core/schemas/domain-events";
import {
  eventReminders,
  events,
  groupFollows,
  groupMembers,
  scheduledNotifications,
} from "@afterclass/core/db/schema";

/**
 * Event handlers for cascade cleanup
 */
export const registerCleanupHandlers = () => {
  /**
   * When an event is deleted, delete all its reminders
   * (notification cancellation is handled in notifications.ts)
   */
  eventBus.on<EventDeleted>("EventDeleted", async (event, ctx) => {
    const { eventId } = event.payload;

    try {
      const deletedReminders = await ctx.db
        .delete(eventReminders)
        .where(eq(eventReminders.eventId, eventId))
        .returning({ eventId: eventReminders.eventId });

      console.log(
        `[CleanupHandler] Event ${eventId} deleted: removed ${deletedReminders.length} reminders`,
      );
    } catch (error) {
      console.error(`[CleanupHandler] Failed to cleanup event reminders:`, error);
    }
  });

  /**
   * When a group is deleted, cascade delete events, members, and follows
   */
  eventBus.on<GroupDeleted>("GroupDeleted", async (event, ctx) => {
    const { groupId } = event.payload;

    try {
      // Delete all scheduled notifications for group events
      const groupEvents = await ctx.db
        .select({ id: events.id })
        .from(events)
        .where(eq(events.groupId, groupId));

      const eventIds = groupEvents.map((e) => e.id);

      if (eventIds.length > 0) {
        for (const eventId of eventIds) {
          await ctx.db
            .update(scheduledNotifications)
            .set({ status: "cancelled" })
            .where(
              and(
                eq(scheduledNotifications.eventId, eventId),
                eq(scheduledNotifications.status, "scheduled"),
              ),
            );

          await ctx.db.delete(eventReminders).where(eq(eventReminders.eventId, eventId));
        }

        await ctx.db.delete(events).where(eq(events.groupId, groupId));
      }

      // Delete members and follows
      await ctx.db.delete(groupMembers).where(eq(groupMembers.groupId, groupId));
      await ctx.db.delete(groupFollows).where(eq(groupFollows.groupId, groupId));

      console.log(
        `[CleanupHandler] Group ${groupId} deleted: cleaned up ${eventIds.length} events, members, and follows`,
      );
    } catch (error) {
      console.error(`[CleanupHandler] Failed to cleanup group:`, error);
    }
  });
};

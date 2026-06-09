import { and, eq } from "drizzle-orm";
import { eventBus } from "@afterclass/core/events";
import type {
  ProfileCreated,
  ProfileUpdated,
  UserBanned,
} from "@afterclass/core/schemas/domain-events";
import { scheduledNotifications } from "@afterclass/core/db/schema";

/**
 * Event handlers for profile-related domain events
 */
export const registerProfileHandlers = () => {
  eventBus.on<ProfileCreated>("ProfileCreated", async (event, _ctx) => {
    console.log("[ProfileHandler] ProfileCreated:", event.payload);
    // Welcome email handled in email.ts handler
  });

  eventBus.on<ProfileUpdated>("ProfileUpdated", async (event, _ctx) => {
    console.log("[ProfileHandler] ProfileUpdated:", event.payload);
  });

  /**
   * When a user is banned, cancel all their scheduled notifications
   */
  eventBus.on<UserBanned>("UserBanned", async (event, ctx) => {
    const { userId, isBanned } = event.payload;

    if (!isBanned) {
      console.log(`[ProfileHandler] User ${userId} unbanned, no cleanup needed`);
      return;
    }

    try {
      const cancelled = await ctx.db
        .update(scheduledNotifications)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(scheduledNotifications.userId, userId),
            eq(scheduledNotifications.status, "scheduled"),
          ),
        )
        .returning({ id: scheduledNotifications.id });

      console.log(
        `[ProfileHandler] UserBanned: cancelled ${cancelled.length} scheduled notifications for user ${userId}`,
      );
    } catch (error) {
      console.error(`[ProfileHandler] Failed to cancel notifications for banned user:`, error);
    }
  });
};

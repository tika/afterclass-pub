import { eq } from "drizzle-orm";
import * as Sentry from "@sentry/node";
import { eventBus } from "@afterclass/core/events";
import type {
  EventCreated,
  EventDeleted,
  EventUpdated,
} from "@afterclass/core/schemas/domain-events";
import { events, groupFollows, groups, notificationLog } from "@afterclass/core/db/schema";
import { sendPushNotification } from "@afterclass/core/services/push";
import { logger } from "@afterclass/core/lib/logger";
import { analytics } from "@afterclass/core/lib/analytics";

/**
 * Event handlers for calendar event domain events
 */
export const registerEventHandlers = () => {
  /**
   * When an event is created, push notify group followers
   */
  eventBus.on<EventCreated>("EventCreated", async (event, ctx) => {
    const { eventId, groupId } = event.payload;

    try {
      const [eventRecord] = await ctx.db
        .select({ title: events.title })
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1);

      const [group] = await ctx.db
        .select({ name: groups.name })
        .from(groups)
        .where(eq(groups.id, groupId))
        .limit(1);

      if (!eventRecord || !group) return;

      // Get all followers of this group
      const followers = await ctx.db
        .select({ userId: groupFollows.userId })
        .from(groupFollows)
        .where(eq(groupFollows.groupId, groupId));

      if (followers.length === 0) return;

      // Send push notification to each follower and log for dedup
      for (const { userId } of followers) {
        await sendPushNotification(ctx, userId, {
          title: group.name,
          body: `New event: ${eventRecord.title}`,
          data: { eventId, groupId, type: "new_event" },
        });

        // Log to notification_log so discovery doesn't re-recommend this event
        await ctx.db
          .insert(notificationLog)
          .values({ userId, eventId, trigger: "following" })
          .onConflictDoNothing();

        analytics.track(userId, "notification_sent", {
          trigger: "following",
          eventId,
          eventTitle: eventRecord.title,
          groupId,
          groupName: group.name,
        });
      }

      logger.info("Follower notifications sent", {
        eventId,
        groupId,
        groupName: group.name,
        eventTitle: eventRecord.title,
        followerCount: followers.length,
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { system: "notifications", trigger: "following" },
        extra: { eventId, groupId },
      });
      logger.error("Failed to notify followers", {
        eventId,
        groupId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * When an event is updated and time/location changed, notify users with reminders
   */
  eventBus.on<EventUpdated>("EventUpdated", async (event, ctx) => {
    const { eventId, changedFields } = event.payload;

    if (!changedFields) return;

    const notifyableFields = ["startTime", "endTime", "locationName", "address"];
    const needsNotification = changedFields.some((f) => notifyableFields.includes(f));
    if (!needsNotification) return;

    try {
      const [eventRecord] = await ctx.db
        .select({ title: events.title })
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1);

      if (!eventRecord) return;

      // Get users who have reminders for this event
      const { eventReminders } = await import("@afterclass/core/db/schema");
      const reminders = await ctx.db
        .select({ userId: eventReminders.userId })
        .from(eventReminders)
        .where(eq(eventReminders.eventId, eventId));

      if (reminders.length === 0) return;

      for (const { userId } of reminders) {
        await sendPushNotification(ctx, userId, {
          title: "Event Updated",
          body: `"${eventRecord.title}" details have changed`,
          data: { eventId, type: "event_updated" },
        });
      }

      logger.info("Event update notifications sent", {
        eventId,
        eventTitle: eventRecord.title,
        changedFields,
        recipientCount: reminders.length,
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { system: "notifications", trigger: "event_updated" },
        extra: { eventId, changedFields },
      });
      logger.error("Failed to notify about event update", {
        eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  eventBus.on<EventDeleted>("EventDeleted", async (event, _ctx) => {
    logger.info("Event deleted", { eventId: event.payload.eventId });
    // Notification cleanup handled in notifications.ts
    // Reminder cleanup handled in cleanup.ts
  });
};

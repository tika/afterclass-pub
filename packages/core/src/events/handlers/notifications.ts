import { eq, and } from "drizzle-orm";
import { eventBus } from "@afterclass/core/events";
import type {
  ReminderCreated,
  ReminderDeleted,
  EventDeleted,
} from "@afterclass/core/schemas/domain-events";
import { events, scheduledNotifications, eventReminders } from "@afterclass/core/db/schema";

/**
 * Calculate notification times based on event start time
 * Returns times for: 1 day before, 1 hour before
 */
function calculateNotificationTimes(eventStartTime: Date): Date[] {
  const times: Date[] = [];
  const now = new Date();

  // 1 day before
  const oneDayBefore = new Date(eventStartTime.getTime() - 24 * 60 * 60 * 1000);
  if (oneDayBefore > now) {
    times.push(oneDayBefore);
  }

  // 1 hour before
  const oneHourBefore = new Date(eventStartTime.getTime() - 60 * 60 * 1000);
  if (oneHourBefore > now) {
    times.push(oneHourBefore);
  }

  return times;
}

/**
 * Event handlers for notification scheduling
 */
export const registerNotificationHandlers = () => {
  /**
   * When a reminder is created, schedule push notifications
   */
  eventBus.on<ReminderCreated>("ReminderCreated", async (event, ctx) => {
    const { userId, eventId } = event.payload;

    try {
      // Fetch the event to get start time
      const [eventRecord] = await ctx.db
        .select({ startTime: events.startTime, title: events.title })
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1);

      if (!eventRecord) {
        console.warn(
          `[NotificationHandler] Event ${eventId} not found, skipping notification scheduling`,
        );
        return;
      }

      // Calculate notification times
      const notificationTimes = calculateNotificationTimes(eventRecord.startTime);

      if (notificationTimes.length === 0) {
        console.log(`[NotificationHandler] No future notification times for event ${eventId}`);
        return;
      }

      // Create scheduled notifications
      const notifications = notificationTimes.map((sendAt) => ({
        userId,
        eventId,
        sendAt,
        type: "event_reminder" as const,
        status: "scheduled" as const,
      }));

      await ctx.db.insert(scheduledNotifications).values(notifications);

      console.log(
        `[NotificationHandler] Scheduled ${notifications.length} notifications for user ${userId}, event "${eventRecord.title}"`,
      );
    } catch (error) {
      console.error(`[NotificationHandler] Failed to schedule notifications:`, error);
    }
  });

  /**
   * When a reminder is deleted, cancel its scheduled notifications
   */
  eventBus.on<ReminderDeleted>("ReminderDeleted", async (event, ctx) => {
    const { userId, eventId } = event.payload;

    try {
      const result = await ctx.db
        .update(scheduledNotifications)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(scheduledNotifications.userId, userId),
            eq(scheduledNotifications.eventId, eventId),
            eq(scheduledNotifications.status, "scheduled"),
          ),
        )
        .returning({ id: scheduledNotifications.id });

      console.log(
        `[NotificationHandler] Cancelled ${result.length} notifications for user ${userId}, event ${eventId}`,
      );
    } catch (error) {
      console.error(`[NotificationHandler] Failed to cancel notifications:`, error);
    }
  });

  /**
   * When an event is deleted, cancel ALL scheduled notifications for it
   * and clean up reminders
   */
  eventBus.on<EventDeleted>("EventDeleted", async (event, ctx) => {
    const { eventId } = event.payload;

    try {
      // Cancel all scheduled notifications for this event
      const cancelledNotifications = await ctx.db
        .update(scheduledNotifications)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(scheduledNotifications.eventId, eventId),
            eq(scheduledNotifications.status, "scheduled"),
          ),
        )
        .returning({ id: scheduledNotifications.id });

      // Delete all reminders for this event
      const deletedReminders = await ctx.db
        .delete(eventReminders)
        .where(eq(eventReminders.eventId, eventId))
        .returning({ eventId: eventReminders.eventId });

      console.log(
        `[NotificationHandler] Event ${eventId} deleted: cancelled ${cancelledNotifications.length} notifications, removed ${deletedReminders.length} reminders`,
      );
    } catch (error) {
      console.error(`[NotificationHandler] Failed to cleanup on event deletion:`, error);
    }
  });
};

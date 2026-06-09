import { and, eq } from "drizzle-orm";
import type { ServiceContext } from "./context";
import { eventReminders, events, scheduledNotifications } from "@afterclass/core/db/schema";
import { eventBus } from "@afterclass/core/events";
import type { ReminderCreated, ReminderDeleted } from "@afterclass/core/schemas/domain-events";

/**
 * Create a reminder for a user for a specific event
 * Emits ReminderCreated event which triggers notification scheduling
 */
export const createReminder = async (ctx: ServiceContext, userId: string, eventId: string) => {
  const result = await ctx.db
    .insert(eventReminders)
    .values({
      userId,
      eventId,
    })
    .returning();

  const reminder = result[0];

  if (reminder) {
    await eventBus.emit<ReminderCreated>({
      type: "ReminderCreated",
      payload: { userId, eventId },
    });
  }

  return reminder;
};

/**
 * Delete a reminder for a user for a specific event
 * Emits ReminderDeleted event which triggers notification cancellation
 */
export const deleteReminder = async (ctx: ServiceContext, userId: string, eventId: string) => {
  // Delete the reminder
  const result = await ctx.db
    .delete(eventReminders)
    .where(and(eq(eventReminders.userId, userId), eq(eventReminders.eventId, eventId)))
    .returning();

  if (result.length === 0) {
    throw new Error("Reminder not found");
  }

  // Emit event - handler will cancel scheduled notifications
  await eventBus.emit<ReminderDeleted>({
    type: "ReminderDeleted",
    payload: { userId, eventId },
  });

  return result[0];
};

/**
 * Get all reminders for a user
 */
export const getUserReminders = async (ctx: ServiceContext, userId: string) => {
  const reminders = await ctx.db
    .select({
      reminder: eventReminders,
      event: events,
    })
    .from(eventReminders)
    .leftJoin(events, eq(eventReminders.eventId, events.id))
    .where(eq(eventReminders.userId, userId));

  return reminders;
};

/**
 * Check if a user has a reminder for a specific event
 */
export const hasReminder = async (ctx: ServiceContext, userId: string, eventId: string) => {
  const result = await ctx.db
    .select()
    .from(eventReminders)
    .where(and(eq(eventReminders.userId, userId), eq(eventReminders.eventId, eventId)))
    .limit(1);

  return result.length > 0 ? result[0] : null;
};

/**
 * Create scheduled notifications for a reminder
 * This is called by mobile app after it calculates notification times
 */
export const createScheduledNotifications = async (
  ctx: ServiceContext,
  userId: string,
  eventId: string,
  notificationTimes: Date[],
) => {
  const notifications = notificationTimes.map((sendAt) => ({
    userId,
    eventId,
    sendAt,
    type: "event_reminder",
    status: "scheduled" as const,
  }));

  const result = await ctx.db.insert(scheduledNotifications).values(notifications).returning();

  return result;
};

/**
 * Mark a notification as delivered (best effort tracking)
 */
export const markNotificationDelivered = async (ctx: ServiceContext, notificationId: string) => {
  const result = await ctx.db
    .update(scheduledNotifications)
    .set({
      status: "sent",
      deliveredAt: new Date(),
    })
    .where(eq(scheduledNotifications.id, notificationId))
    .returning();

  return result[0];
};

/**
 * Cancel scheduled notifications for an event reminder
 */
export const cancelScheduledNotifications = async (
  ctx: ServiceContext,
  userId: string,
  eventId: string,
) => {
  const result = await ctx.db
    .update(scheduledNotifications)
    .set({
      status: "cancelled",
    })
    .where(
      and(
        eq(scheduledNotifications.userId, userId),
        eq(scheduledNotifications.eventId, eventId),
        eq(scheduledNotifications.status, "scheduled"),
      ),
    )
    .returning();

  return result;
};

/**
 * Get notification statistics for an event
 */
export const getEventNotificationStats = async (ctx: ServiceContext, eventId: string) => {
  const allNotifications = await ctx.db
    .select()
    .from(scheduledNotifications)
    .where(eq(scheduledNotifications.eventId, eventId));

  const uniqueUsers = new Set(allNotifications.map((n) => n.userId));
  const sent = allNotifications.filter((n) => n.status === "sent").length;
  const scheduled = allNotifications.filter((n) => n.status === "scheduled").length;

  return {
    totalUsers: uniqueUsers.size,
    totalNotifications: allNotifications.length,
    sent,
    scheduled,
    deliveryRate: allNotifications.length > 0 ? (sent / allNotifications.length) * 100 : 0,
  };
};

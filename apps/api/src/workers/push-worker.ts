import type { SQSEvent, SQSRecord } from "aws-lambda";
import { eq } from "drizzle-orm";
import * as Sentry from "@sentry/node";
import { events, scheduledNotifications } from "@afterclass/core/db/schema";
import { createServiceContext } from "@afterclass/core";
import * as pushService from "@afterclass/core/services/push";
import { logger } from "@afterclass/core/lib/logger";
import { analytics } from "@afterclass/core/lib/analytics";

type QueueMessage = {
  notificationId: string;
  userId: string;
  eventId: string;
  type: string;
  sendAt: string;
};

function formatEventReminderContent(
  event: { title: string; locationName: string; startTime: Date },
  sendAt: Date,
): { title: string; body: string } {
  const startTime = new Date(event.startTime);
  const minutesBefore = Math.round((startTime.getTime() - sendAt.getTime()) / (60 * 1000));

  if (minutesBefore <= 0) {
    return {
      title: `${event.title} is starting now!`,
      body: `Event at ${event.locationName}`,
    };
  }

  const hours = Math.floor(minutesBefore / 60);
  const mins = minutesBefore % 60;

  let timeString: string;
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    timeString = `${days} day${days > 1 ? "s" : ""}`;
  } else if (hours >= 1) {
    timeString = mins > 0 ? `${hours}h ${mins}m` : `${hours} hour${hours > 1 ? "s" : ""}`;
  } else {
    timeString = `${mins} minute${mins > 1 ? "s" : ""}`;
  }

  return {
    title: `${event.title} in ${timeString}`,
    body: `Event at ${event.locationName}`,
  };
}

async function processRecord(record: SQSRecord): Promise<void> {
  const body = JSON.parse(record.body) as QueueMessage;
  const { notificationId, userId, eventId } = body;

  const ctx = await createServiceContext();

  const [notification] = await ctx.db
    .select()
    .from(scheduledNotifications)
    .where(eq(scheduledNotifications.id, notificationId))
    .limit(1);

  if (
    !notification ||
    (notification.status !== "scheduled" && notification.status !== "enqueued")
  ) {
    return;
  }

  const [eventRow] = await ctx.db.select().from(events).where(eq(events.id, eventId)).limit(1);

  if (!eventRow) {
    await ctx.db
      .update(scheduledNotifications)
      .set({ status: "cancelled" })
      .where(eq(scheduledNotifications.id, notificationId));
    return;
  }

  const sendAt = new Date(body.sendAt);
  const { title, body: bodyText } = formatEventReminderContent(
    {
      title: eventRow.title,
      locationName: eventRow.locationName,
      startTime: eventRow.startTime,
    },
    sendAt,
  );

  await pushService.sendPushNotification(ctx, userId, {
    title,
    body: bodyText,
    data: { eventId, type: "event_reminder" },
  });

  await ctx.db
    .update(scheduledNotifications)
    .set({ status: "sent", deliveredAt: new Date() })
    .where(eq(scheduledNotifications.id, notificationId));

  analytics.track(userId, "notification_sent", {
    trigger: "reminder",
    eventId,
    eventTitle: eventRow.title,
    notificationId,
  });

  logger.info("Reminder notification sent", {
    userId,
    eventId,
    notificationId,
    eventTitle: eventRow.title,
  });
}

/**
 * Lambda handler: Process SQS messages and send push notifications
 * Triggered by SQS
 */
export const pushWorkerHandler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch (err) {
      Sentry.captureException(err, {
        tags: { system: "notifications", trigger: "reminder" },
      });
      logger.error("Failed to process push notification", {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
};

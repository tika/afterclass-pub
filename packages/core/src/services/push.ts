import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { and, eq, lte } from "drizzle-orm";
import { ApnsClient, Notification as ApnsNotification, Errors } from "apns2";
import type { ServiceContext } from "./context";
import { deviceTokens, scheduledNotifications, users } from "@afterclass/core/db/schema";

export type PushNotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

let apnClient: ApnsClient | null = null;

function getApnClient(ctx: ServiceContext): ApnsClient | null {
  if (apnClient) return apnClient;

  const { apnsKeyId, apnsTeamId, apnsBundleId, apnsKeyP8 } = ctx.secrets;

  if (!apnsKeyId || !apnsTeamId || !apnsBundleId || !apnsKeyP8) {
    console.warn("APNs credentials not configured; push notifications will be skipped");
    return null;
  }

  try {
    apnClient = new ApnsClient({
      team: apnsTeamId,
      keyId: apnsKeyId,
      signingKey: apnsKeyP8,
      defaultTopic: apnsBundleId,
      host: process.env.STAGE === "prod" ? undefined : "api.sandbox.push.apple.com",
    });
    return apnClient;
  } catch (err) {
    console.error("Failed to create APNs client:", err);
    return null;
  }
}

/**
 * Send push notification to all devices for a user
 */
export const sendPushNotification = async (
  ctx: ServiceContext,
  userId: string,
  payload: PushNotificationPayload,
): Promise<{ sent: number; failed: number; errors?: string[] }> => {
  const client = getApnClient(ctx);

  const tokens = await ctx.db
    .select({ token: deviceTokens.token })
    .from(deviceTokens)
    .where(eq(deviceTokens.userId, userId));

  if (tokens.length === 0) {
    return { sent: 0, failed: 0 };
  }

  if (!client) {
    return {
      sent: 0,
      failed: tokens.length,
      errors: [
        "APNs client not configured — check apnsKeyId, apnsTeamId, apnsBundleId, apnsKeyP8 secrets",
      ],
    };
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const { token } of tokens) {
    try {
      const notification = new ApnsNotification(token, {
        alert: { title: payload.title, body: payload.body },
        sound: "default",
        expiration: Math.floor(Date.now() / 1000) + 86400,
        ...(payload.data && { payload: payload.data }),
      });
      await client.send(notification);
      sent++;
    } catch (err: unknown) {
      failed++;
      const reason = (err as { reason?: string })?.reason;
      const msg = reason || (err instanceof Error ? err.message : String(err));
      console.error(`Failed to send push to token ${token.slice(0, 10)}...:`, err);
      errors.push(`Token ${token.slice(0, 8)}…: ${msg}`);
      if (reason === Errors.badDeviceToken || reason === Errors.unregistered) {
        await ctx.db.delete(deviceTokens).where(eq(deviceTokens.token, token));
      }
    }
  }

  return { sent, failed, errors };
};

/**
 * Get all device tokens with user info (admin)
 */
export const getAllDeviceTokens = async (ctx: ServiceContext) => {
  return ctx.db
    .select({
      id: deviceTokens.id,
      userId: deviceTokens.userId,
      token: deviceTokens.token,
      createdAt: deviceTokens.createdAt,
      updatedAt: deviceTokens.updatedAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(deviceTokens)
    .leftJoin(users, eq(deviceTokens.userId, users.id));
};

/**
 * Broadcast push notification to all registered devices
 */
export const broadcastPushNotification = async (
  ctx: ServiceContext,
  payload: PushNotificationPayload,
): Promise<{ sent: number; failed: number; errors?: string[] }> => {
  const client = getApnClient(ctx);

  const allTokens = await ctx.db.select({ token: deviceTokens.token }).from(deviceTokens);

  if (allTokens.length === 0) {
    return { sent: 0, failed: 0 };
  }

  if (!client) {
    return { sent: 0, failed: allTokens.length };
  }

  let sent = 0;
  let failed = 0;

  for (const { token } of allTokens) {
    try {
      const notification = new ApnsNotification(token, {
        alert: { title: payload.title, body: payload.body },
        sound: "default",
        expiration: Math.floor(Date.now() / 1000) + 86400,
        ...(payload.data && { payload: payload.data }),
      });
      await client.send(notification);
      sent++;
    } catch (err: unknown) {
      const reason = (err as { reason?: string })?.reason;
      console.error(`Failed to send push to token ${token.slice(0, 10)}...:`, err);
      failed++;
      if (reason === Errors.badDeviceToken || reason === Errors.unregistered) {
        await ctx.db.delete(deviceTokens).where(eq(deviceTokens.token, token));
      }
    }
  }

  return { sent, failed };
};

/**
 * Register or update device token for user
 */
export const upsertDeviceToken = async (
  ctx: ServiceContext,
  userId: string,
  token: string,
): Promise<void> => {
  await ctx.db
    .insert(deviceTokens)
    .values({ userId, token })
    .onConflictDoUpdate({
      target: deviceTokens.token,
      set: { userId, updatedAt: new Date() },
    });
};

/**
 * Remove device token (e.g. on logout)
 */
export const removeDeviceToken = async (
  ctx: ServiceContext,
  userId: string,
  token: string,
): Promise<void> => {
  await ctx.db
    .delete(deviceTokens)
    .where(and(eq(deviceTokens.userId, userId), eq(deviceTokens.token, token)));
};

export type EnqueueDueResult = {
  enqueued: number;
  error?: string;
};

/**
 * Poll for due scheduled notifications and enqueue to SQS.
 * Used by the poller Lambda (EventBridge every 1 min).
 * Caller passes queueUrl from PUSH_NOTIFICATIONS_QUEUE_URL env.
 */
export const enqueueDueScheduledNotifications = async (
  ctx: ServiceContext,
  queueUrl: string,
): Promise<EnqueueDueResult> => {
  if (!queueUrl) {
    return { enqueued: 0, error: "PUSH_NOTIFICATIONS_QUEUE_URL not set" };
  }

  const now = new Date();
  const due = await ctx.db
    .select()
    .from(scheduledNotifications)
    .where(
      and(lte(scheduledNotifications.sendAt, now), eq(scheduledNotifications.status, "scheduled")),
    );

  if (due.length === 0) {
    return { enqueued: 0 };
  }

  const sqs = new SQSClient({});
  let enqueued = 0;

  for (const notification of due) {
    try {
      await sqs.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify({
            notificationId: notification.id,
            userId: notification.userId,
            eventId: notification.eventId,
            type: notification.type,
            sendAt: notification.sendAt.toISOString(),
          }),
        }),
      );

      await ctx.db
        .update(scheduledNotifications)
        .set({ status: "enqueued" })
        .where(eq(scheduledNotifications.id, notification.id));

      enqueued++;
    } catch (err) {
      console.error(`Failed to enqueue notification ${notification.id}:`, err);
    }
  }

  return { enqueued };
};

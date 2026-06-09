import { createServiceContext } from "@afterclass/core";
import { enqueueDueScheduledNotifications } from "@afterclass/core/services/push";
import type { EnqueueDueResult } from "@afterclass/core/services/push";
import { processDueDiscoverySlots } from "@afterclass/core/services/discovery";

export type PollerResult = EnqueueDueResult & {
  discovery?: { sent: number; skipped: number };
};

/**
 * Lambda handler: Poll for due scheduled notifications and enqueue to SQS,
 * then process any due discovery schedule slots.
 * Triggered by EventBridge every 1 minute.
 */
export const pollerHandler = async (_event?: unknown): Promise<PollerResult> => {
  const ctx = await createServiceContext();
  const queueUrl = process.env.PUSH_NOTIFICATIONS_QUEUE_URL ?? "";

  // Existing: enqueue due saved-event reminders
  const reminderResult = await enqueueDueScheduledNotifications(ctx, queueUrl);

  // New: process due discovery notifications (2x/week per user)
  const discoveryResult = await processDueDiscoverySlots(ctx);

  return {
    ...reminderResult,
    discovery: discoveryResult,
  };
};

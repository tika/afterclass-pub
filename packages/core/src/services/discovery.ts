import { and, eq, lte } from "drizzle-orm";
import { addDays, setHours, setMinutes, nextSunday, format } from "date-fns";
import { TZDate } from "@date-fns/tz";
import * as Sentry from "@sentry/node";
import type { ServiceContext } from "@afterclass/core/services/context";
import { deviceTokens, discoverySchedule, notificationLog } from "@afterclass/core/db/schema";
import { recommendEvent } from "@afterclass/core/services/recommender";
import { sendPushNotification } from "@afterclass/core/services/push";
import { logger } from "@afterclass/core/lib/logger";
import { analytics } from "@afterclass/core/lib/analytics";

/**
 * Campus timezone — used for scheduling discovery notifications during
 * waking hours. Change this constant if the app expands to multiple campuses,
 * or move to a per-user column at that point.
 */
export const CAMPUS_TIMEZONE = "America/New_York";

/** Waking-hour window for random send times (campus-local time) */
const EARLIEST_HOUR = 10; // 10 AM
const LATEST_HOUR = 20; // 8 PM

/** Number of discovery notifications per user per week */
const SLOTS_PER_WEEK = 2;

/**
 * Generate a random campus-local time on a given day within waking hours.
 * Returns a UTC Date that corresponds to the chosen campus-local time.
 */
function randomTimeOnDay(day: Date): Date {
  const hour = EARLIEST_HOUR + Math.floor(Math.random() * (LATEST_HOUR - EARLIEST_HOUR));
  const minute = Math.floor(Math.random() * 60);

  // Build the time in campus timezone — TZDate handles DST automatically
  const campusDate = new TZDate(day, CAMPUS_TIMEZONE);
  return setMinutes(setHours(campusDate, hour), minute);
}

/**
 * Pick N unique random days (Mon–Sat) from the week starting at weekStart (Sunday).
 */
function pickRandomDays(weekStart: Date, count: number): Date[] {
  const available = [1, 2, 3, 4, 5, 6]; // Mon=1 through Sat=6

  const picked: number[] = [];
  for (let i = 0; i < count && available.length > 0; i++) {
    const idx = Math.floor(Math.random() * available.length);
    picked.push(available.splice(idx, 1)[0]);
  }

  return picked.map((offset) => addDays(weekStart, offset));
}

/**
 * Generate discovery schedule slots for all users with device tokens.
 * Intended to run once per week (e.g., Sunday midnight via EventBridge).
 */
export async function generateWeeklySchedule(ctx: ServiceContext): Promise<{ created: number }> {
  // Get all users who have at least one device token
  const usersWithTokens = await ctx.db
    .selectDistinct({ userId: deviceTokens.userId })
    .from(deviceTokens);

  if (usersWithTokens.length === 0) {
    return { created: 0 };
  }

  // weekStart = the upcoming Sunday at midnight campus time
  const weekStart = nextSunday(new TZDate(new Date(), CAMPUS_TIMEZONE));

  const rows: { userId: string; sendAt: Date }[] = [];

  for (const { userId } of usersWithTokens) {
    const days = pickRandomDays(weekStart, SLOTS_PER_WEEK);
    for (const day of days) {
      rows.push({ userId, sendAt: randomTimeOnDay(day) });
    }
  }

  if (rows.length === 0) {
    return { created: 0 };
  }

  // Batch insert in chunks to avoid oversized queries
  const CHUNK_SIZE = 500;
  let created = 0;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const result = await ctx.db
      .insert(discoverySchedule)
      .values(chunk)
      .returning({ id: discoverySchedule.id });
    created += result.length;
  }

  logger.info("Weekly discovery schedule generated", {
    userCount: usersWithTokens.length,
    slotsCreated: created,
  });

  analytics.track("system", "discovery_schedule_generated", {
    userCount: usersWithTokens.length,
    slotsCreated: created,
  });

  return { created };
}

/**
 * Process all due discovery schedule slots: for each, run the recommender,
 * send a push notification, and log the result.
 *
 * Called by the poller Lambda alongside the existing scheduled_notifications poll.
 */
export async function processDueDiscoverySlots(
  ctx: ServiceContext,
): Promise<{ sent: number; skipped: number }> {
  const now = new Date();

  const dueSlots = await ctx.db
    .select()
    .from(discoverySchedule)
    .where(and(lte(discoverySchedule.sendAt, now), eq(discoverySchedule.status, "pending")));

  let sent = 0;
  let skipped = 0;

  for (const slot of dueSlots) {
    try {
      const recommendation = await recommendEvent(ctx, slot.userId);

      if (!recommendation) {
        await ctx.db
          .update(discoverySchedule)
          .set({ status: "skipped" })
          .where(eq(discoverySchedule.id, slot.id));

        analytics.track(slot.userId, "notification_skipped", {
          trigger: "discovery",
          reason: "no_relevant_event",
        });

        skipped++;
        continue;
      }

      const { event, score } = recommendation;

      const campusTime = new TZDate(event.startTime, CAMPUS_TIMEZONE);
      const timeStr = format(campusTime, "EEE, MMM d · h:mm a");

      await sendPushNotification(ctx, slot.userId, {
        title: `📅 ${event.title}`,
        body: `${timeStr} · ${event.locationName}`,
        data: { eventId: event.id, type: "discovery" },
      });

      // Log for idempotency — ignore conflict (already notified)
      await ctx.db
        .insert(notificationLog)
        .values({
          userId: slot.userId,
          eventId: event.id,
          trigger: "discovery",
        })
        .onConflictDoNothing();

      // Mark slot as sent and record which event was recommended
      await ctx.db
        .update(discoverySchedule)
        .set({ status: "sent", eventId: event.id })
        .where(eq(discoverySchedule.id, slot.id));

      analytics.track(slot.userId, "notification_sent", {
        trigger: "discovery",
        eventId: event.id,
        eventTitle: event.title,
        similarityScore: score,
      });

      logger.info("Discovery notification sent", {
        userId: slot.userId,
        eventId: event.id,
        eventTitle: event.title,
        score,
      });

      sent++;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { system: "discovery" },
        extra: { slotId: slot.id, userId: slot.userId },
      });
      logger.error("Failed to process discovery slot", {
        slotId: slot.id,
        userId: slot.userId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Leave as pending — will retry on next poll
    }
  }

  return { sent, skipped };
}

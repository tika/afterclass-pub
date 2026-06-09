import { and, eq, gte, lte } from "drizzle-orm";
import { compareTwoStrings } from "@afterclass/core/lib/stringSimilarity";
import { events, flyerSubmissions, groups } from "@afterclass/core/db/schema";
import { getPublicUrl } from "@afterclass/core/lib/s3";
import type { ServiceContext } from "@afterclass/core/services/context";
import { createEvent } from "@afterclass/core/services/events";
import { extractFlyerData } from "@afterclass/core/services/flyerExtraction";
import { fuzzyMatchGroup } from "@afterclass/core/services/groups";

const MAX_FLYER_SIZE = 4.5 * 1024 * 1024; // 4.5MB

/** System user ID for events created from flyer submissions (no human admin) */
const FLYER_SUBMISSION_SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001";

export interface ProcessResult {
  submission: typeof flyerSubmissions.$inferSelect;
  extractedData: {
    title: string;
    orgName: string;
    startDate: string | null;
    startTime: string | null;
    endTime: string | null;
    locationName: string | null;
    description: string | null;
    isEvent: boolean;
  };
  matchedGroup: { id: string; name: string; confidence: number } | null;
  draftEvent: Omit<typeof events.$inferSelect, "embedding"> | null;
}

/** Thrown when the flyer is not an event (e.g., service, hotline, ongoing resource) */
export class NotAnEventError extends Error {
  constructor(message: string = "This flyer doesn't appear to be an event") {
    super(message);
    this.name = "NotAnEventError";
  }
}

/** Thrown when a duplicate event is detected */
export class DuplicateEventError extends Error {
  existingEventId: string;
  constructor(message: string, existingEventId: string) {
    super(message);
    this.name = "DuplicateEventError";
    this.existingEventId = existingEventId;
  }
}

export interface ExtractResult {
  submission: typeof flyerSubmissions.$inferSelect;
  extractedData: {
    title: string;
    orgName: string;
    startDate: string | null;
    startTime: string | null;
    endTime: string | null;
    locationName: string | null;
    description: string | null;
    isEvent: boolean;
  };
  matchedGroup: { id: string; name: string; confidence: number } | null;
}

export interface ConfirmedData {
  title: string;
  orgName: string;
  startDate: string | null;
  startTime: string | null;
  endTime: string | null;
  locationName: string | null;
  description: string | null;
}

const DUPLICATE_TITLE_THRESHOLD = 0.75;
const DUPLICATE_WINDOW_HOURS = 24;

async function findDuplicateEvent(
  ctx: ServiceContext,
  groupId: string,
  title: string,
  startTime: Date,
): Promise<{ id: string; title: string } | null> {
  const windowMs = DUPLICATE_WINDOW_HOURS * 60 * 60 * 1000;
  const windowStart = new Date(startTime.getTime() - windowMs);
  const windowEnd = new Date(startTime.getTime() + windowMs);

  const candidates = await ctx.db
    .select({ id: events.id, title: events.title })
    .from(events)
    .where(
      and(
        eq(events.groupId, groupId),
        gte(events.startTime, windowStart),
        lte(events.startTime, windowEnd),
      ),
    );

  const normalizedTitle = title.trim().toLowerCase();
  for (const candidate of candidates) {
    const score = compareTwoStrings(normalizedTitle, candidate.title.trim().toLowerCase());
    if (score >= DUPLICATE_TITLE_THRESHOLD) {
      return { id: candidate.id, title: candidate.title };
    }
  }

  return null;
}

export async function extractFlyerSubmission(
  ctx: ServiceContext,
  s3Key: string,
): Promise<ExtractResult> {
  const s3Url = getPublicUrl(s3Key);

  // Create submission record (pending)
  const [submission] = await ctx.db
    .insert(flyerSubmissions)
    .values({
      s3Key,
      s3Url,
      status: "pending",
    })
    .returning();

  if (!submission) {
    throw new Error("Failed to create flyer submission record");
  }

  try {
    // Extract data from image via Gemini
    const mimeType = s3Key.endsWith(".png")
      ? "image/png"
      : s3Key.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";

    // Fetch group names for Gemini-assisted matching
    const allGroups = await ctx.db.select({ name: groups.name }).from(groups);
    const groupNames = allGroups.map((g: { name: string }) => g.name);

    const extractedData = await extractFlyerData(ctx, s3Url, mimeType, groupNames);

    // Reject if not an event (e.g., service, hotline, ongoing resource)
    if (!extractedData.isEvent) {
      await ctx.db
        .update(flyerSubmissions)
        .set({
          extractedData: extractedData as unknown as Record<string, unknown>,
          status: "rejected",
          errorMessage: "Not an event",
          updatedAt: new Date(),
        })
        .where(eq(flyerSubmissions.id, submission.id));

      throw new NotAnEventError(
        "This flyer doesn't appear to be an event. We only accept posters for one-time or recurring events with specific dates or times.",
      );
    }

    // Fuzzy match org name to group
    const { group: matchedGroup, confidence } = await fuzzyMatchGroup(ctx, extractedData.orgName);

    // Update submission to extracted status
    const [updated] = await ctx.db
      .update(flyerSubmissions)
      .set({
        extractedData: extractedData as unknown as Record<string, unknown>,
        matchedGroupId: matchedGroup?.id ?? null,
        matchConfidence: confidence,
        status: "extracted",
        updatedAt: new Date(),
      })
      .where(eq(flyerSubmissions.id, submission.id))
      .returning();

    return {
      submission: updated ?? submission,
      extractedData,
      matchedGroup: matchedGroup
        ? { id: matchedGroup.id, name: matchedGroup.name, confidence }
        : null,
    };
  } catch (err) {
    if (err instanceof NotAnEventError) {
      throw err;
    }
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    await ctx.db
      .update(flyerSubmissions)
      .set({
        status: "failed",
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(flyerSubmissions.id, submission.id));

    throw err;
  }
}

export async function confirmFlyerSubmission(
  ctx: ServiceContext,
  submissionId: string,
  confirmedData: ConfirmedData,
): Promise<ProcessResult> {
  // Look up existing submission
  const [submission] = await ctx.db
    .select()
    .from(flyerSubmissions)
    .where(eq(flyerSubmissions.id, submissionId));

  if (!submission) {
    throw new Error("Submission not found");
  }

  if (submission.status !== "extracted") {
    throw new Error(`Submission is not in extracted status (current: ${submission.status})`);
  }

  // Re-match group based on confirmed orgName (user may have edited it)
  const { group: matchedGroup, confidence } = await fuzzyMatchGroup(ctx, confirmedData.orgName);

  let draftEvent: Omit<typeof events.$inferSelect, "embedding"> | null = null;

  if (matchedGroup && confidence >= 0.4) {
    // Build startTime: use confirmed date/time or default to tomorrow noon
    let startTime: Date;
    if (confirmedData.startDate && confirmedData.startTime) {
      startTime = new Date(`${confirmedData.startDate}T${confirmedData.startTime}:00`);
    } else if (confirmedData.startDate) {
      startTime = new Date(`${confirmedData.startDate}T12:00:00`);
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);
      startTime = tomorrow;
    }

    // Build endTime if we have it
    let endTime: Date | undefined;
    if (confirmedData.endTime && confirmedData.startDate) {
      endTime = new Date(`${confirmedData.startDate}T${confirmedData.endTime}:00`);
    } else if (confirmedData.endTime) {
      endTime = new Date(startTime);
      const [h, m] = confirmedData.endTime.split(":").map(Number);
      endTime.setHours(h, m, 0, 0);
    }

    // Check for duplicate events
    const duplicate = await findDuplicateEvent(
      ctx,
      matchedGroup.id,
      confirmedData.title,
      startTime,
    );
    if (duplicate) {
      throw new DuplicateEventError(
        `An event "${duplicate.title}" already exists for this club around the same time`,
        duplicate.id,
      );
    }

    draftEvent = await createEvent(
      ctx,
      {
        title: confirmedData.title || "Untitled Event",
        description: confirmedData.description ?? undefined,
        flyerImages: [submission.s3Url],
        startTime: startTime.toISOString(),
        endTime: endTime?.toISOString(),
        locationName: confirmedData.locationName || "TBD",
        status: "DRAFT",
        sourceUrl: submission.s3Url,
        metadata: { flyerSubmissionId: submission.id },
        groupId: matchedGroup.id,
      },
      FLYER_SUBMISSION_SYSTEM_USER_ID,
      false, // skip group admin check - system-created from flyer
    );
  }

  // Update submission with results
  const extractedData = {
    ...confirmedData,
    isEvent: true,
  };

  const [updated] = await ctx.db
    .update(flyerSubmissions)
    .set({
      extractedData: extractedData as unknown as Record<string, unknown>,
      matchedGroupId: matchedGroup?.id ?? null,
      matchConfidence: confidence,
      eventId: draftEvent?.id ?? null,
      status: "processed",
      updatedAt: new Date(),
    })
    .where(eq(flyerSubmissions.id, submission.id))
    .returning();

  return {
    submission: updated ?? submission,
    extractedData,
    matchedGroup: matchedGroup
      ? { id: matchedGroup.id, name: matchedGroup.name, confidence }
      : null,
    draftEvent,
  };
}

export async function processFlyerSubmission(
  ctx: ServiceContext,
  s3Key: string,
): Promise<ProcessResult> {
  const s3Url = getPublicUrl(s3Key);

  // Create submission record (pending)
  const [submission] = await ctx.db
    .insert(flyerSubmissions)
    .values({
      s3Key,
      s3Url,
      status: "pending",
    })
    .returning();

  if (!submission) {
    throw new Error("Failed to create flyer submission record");
  }

  try {
    // Extract data from image via Gemini
    const mimeType = s3Key.endsWith(".png")
      ? "image/png"
      : s3Key.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";

    // Fetch group names for Gemini-assisted matching
    const allGroups = await ctx.db.select({ name: groups.name }).from(groups);
    const groupNames = allGroups.map((g: { name: string }) => g.name);

    const extractedData = await extractFlyerData(ctx, s3Url, mimeType, groupNames);

    // Reject if not an event (e.g., service, hotline, ongoing resource)
    if (!extractedData.isEvent) {
      await ctx.db
        .update(flyerSubmissions)
        .set({
          extractedData: extractedData as unknown as Record<string, unknown>,
          status: "rejected",
          errorMessage: "Not an event",
          updatedAt: new Date(),
        })
        .where(eq(flyerSubmissions.id, submission.id));

      throw new NotAnEventError(
        "This flyer doesn't appear to be an event. We only accept posters for one-time or recurring events with specific dates or times.",
      );
    }

    // Fuzzy match org name to group
    const { group: matchedGroup, confidence } = await fuzzyMatchGroup(ctx, extractedData.orgName);

    let draftEvent: Omit<typeof events.$inferSelect, "embedding"> | null = null;

    if (matchedGroup && confidence >= 0.4) {
      // Build startTime: use extracted date/time or default to tomorrow noon
      let startTime: Date;
      if (extractedData.startDate && extractedData.startTime) {
        startTime = new Date(`${extractedData.startDate}T${extractedData.startTime}:00`);
      } else if (extractedData.startDate) {
        startTime = new Date(`${extractedData.startDate}T12:00:00`);
      } else {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(12, 0, 0, 0);
        startTime = tomorrow;
      }

      // Build endTime if we have it
      let endTime: Date | undefined;
      if (extractedData.endTime && extractedData.startDate) {
        endTime = new Date(`${extractedData.startDate}T${extractedData.endTime}:00`);
      } else if (extractedData.endTime) {
        endTime = new Date(startTime);
        const [h, m] = extractedData.endTime.split(":").map(Number);
        endTime.setHours(h, m, 0, 0);
      }

      // Check for duplicate events
      const duplicate = await findDuplicateEvent(
        ctx,
        matchedGroup.id,
        extractedData.title,
        startTime,
      );
      if (duplicate) {
        throw new DuplicateEventError(
          `An event "${duplicate.title}" already exists for this club around the same time`,
          duplicate.id,
        );
      }

      draftEvent = await createEvent(
        ctx,
        {
          title: extractedData.title || "Untitled Event",
          description: extractedData.description ?? undefined,
          flyerImages: [s3Url],
          startTime: startTime.toISOString(),
          endTime: endTime?.toISOString(),
          locationName: extractedData.locationName || "TBD",
          status: "DRAFT",
          sourceUrl: s3Url,
          metadata: { flyerSubmissionId: submission.id },
          groupId: matchedGroup.id,
        },
        FLYER_SUBMISSION_SYSTEM_USER_ID,
        false, // skip group admin check - system-created from flyer
      );
    }

    // Update submission with results
    const [updated] = await ctx.db
      .update(flyerSubmissions)
      .set({
        extractedData: extractedData as unknown as Record<string, unknown>,
        matchedGroupId: matchedGroup?.id ?? null,
        matchConfidence: confidence,
        eventId: draftEvent?.id ?? null,
        status: "processed",
        updatedAt: new Date(),
      })
      .where(eq(flyerSubmissions.id, submission.id))
      .returning();

    return {
      submission: updated ?? submission,
      extractedData,
      matchedGroup: matchedGroup
        ? { id: matchedGroup.id, name: matchedGroup.name, confidence }
        : null,
      draftEvent,
    };
  } catch (err) {
    if (err instanceof NotAnEventError || err instanceof DuplicateEventError) {
      throw err;
    }
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    await ctx.db
      .update(flyerSubmissions)
      .set({
        status: "failed",
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(flyerSubmissions.id, submission.id));

    throw err;
  }
}

export { MAX_FLYER_SIZE };

import { and, asc, cosineDistance, desc, eq, gte, gt, lte, notInArray, or, sql } from "drizzle-orm";
import type { ServiceContext } from "@afterclass/core/services/context";
import {
  events,
  eventPublicColumns,
  groups,
  groupPublicColumns,
  notificationLog,
  users,
} from "@afterclass/core/db/schema";
import { getOrCreateEmbedding } from "@afterclass/core/services/embeddings";
import { getInterestSearchText } from "@afterclass/core/services/interestKeywords";

export type RecommendedEvent = {
  event: {
    id: string;
    title: string;
    startTime: Date;
    locationName: string;
    [key: string]: unknown;
  };
  group: { name: string; [key: string]: unknown } | null;
  score: number;
};

/**
 * Find the single most relevant upcoming event for a user based on their
 * majors and interests. Uses embedding cosine similarity, exactly like the
 * existing feed queries.
 *
 * This is the "swappable brain" — change the ranking logic here and the
 * rest of the notification pipeline stays untouched.
 */
export async function recommendEvent(
  ctx: ServiceContext,
  userId: string,
  options: { windowDays?: number } = {},
): Promise<RecommendedEvent | null> {
  const windowDays = options.windowDays ?? 3;
  const now = new Date();
  const windowEnd = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

  // 1. Load user profile
  const [user] = await ctx.db
    .select({ majors: users.majors, interests: users.interests })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return null;

  const hasMajors = user.majors && user.majors.length > 0;
  const hasInterests = user.interests && user.interests.length > 0;

  if (!hasMajors && !hasInterests) return null;

  // 2. Build a combined embedding from majors + interests
  const textParts: string[] = [];
  if (hasMajors) textParts.push(user.majors!.join(" "));
  if (hasInterests) textParts.push(user.interests!.map((i) => getInterestSearchText(i)).join(" "));

  const profileText = textParts.join(" ");
  const embedding = await getOrCreateEmbedding(ctx, profileText, {
    cacheKey: `embedding:user:${userId}:discovery`,
    ttlSeconds: 60 * 60 * 24, // 24h
  });

  // 3. Get event IDs already notified to this user (any trigger type)
  const alreadyNotified = await ctx.db
    .select({ eventId: notificationLog.eventId })
    .from(notificationLog)
    .where(eq(notificationLog.userId, userId));

  const excludeIds = alreadyNotified.map((r) => r.eventId);

  // 4. Query upcoming events ranked by similarity, excluding already-notified
  const eventSimilarity = sql<number>`1 - (${cosineDistance(events.embedding, embedding)})`;
  const groupSimilarity = sql<number>`1 - (${cosineDistance(groups.embedding, embedding)})`;
  const combinedScore = sql<number>`GREATEST(
    COALESCE(1 - (${cosineDistance(events.embedding, embedding)}), 0),
    COALESCE(1 - (${cosineDistance(groups.embedding, embedding)}), 0)
  )`;

  const conditions = [
    gte(events.startTime, now),
    lte(events.startTime, windowEnd),
    eq(events.status, "PUBLISHED"),
    or(
      and(sql`${events.embedding} IS NOT NULL`, gt(eventSimilarity, 0.3)),
      and(sql`${groups.embedding} IS NOT NULL`, gt(groupSimilarity, 0.3)),
    ),
  ];

  if (excludeIds.length > 0) {
    conditions.push(notInArray(events.id, excludeIds));
  }

  const results = await ctx.db
    .select({
      event: eventPublicColumns,
      group: groupPublicColumns,
      score: combinedScore,
    })
    .from(events)
    .leftJoin(groups, eq(events.groupId, groups.id))
    .where(and(...conditions))
    .orderBy(desc(combinedScore))
    .limit(1);

  if (results.length === 0) return null;

  return results[0] as RecommendedEvent;
}

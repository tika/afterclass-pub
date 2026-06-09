import { and, asc, cosineDistance, eq, gt, gte, or, sql } from "drizzle-orm";
import type { ServiceContext } from "@afterclass/core/services/context";
import {
  eventPublicColumns,
  events,
  groupPublicColumns,
  groups,
  users,
} from "@afterclass/core/db/schema";
import { getOrCreateEmbedding } from "@afterclass/core/services/embeddings";
import { getInterestSearchText } from "@afterclass/core/services/interestKeywords";

export const getFeed = async (
  ctx: ServiceContext,
  options: { limit?: number; offset?: number },
) => {
  const limit = options.limit || 20;
  const offset = options.offset || 0;
  const now = new Date();

  return await ctx.db
    .select({
      event: eventPublicColumns,
      group: groupPublicColumns,
    })
    .from(events)
    .leftJoin(groups, eq(events.groupId, groups.id))
    .where(and(gte(events.startTime, now), eq(events.status, "PUBLISHED")))
    .orderBy(asc(events.startTime))
    .limit(limit)
    .offset(offset);
};

export const getMajorFeed = async (
  ctx: ServiceContext,
  options: {
    userId: string;
    limit?: number;
    offset?: number;
  },
) => {
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;
  const now = new Date();

  const [user] = await ctx.db
    .select({ majors: users.majors })
    .from(users)
    .where(eq(users.id, options.userId))
    .limit(1);

  if (!user?.majors || user.majors.length === 0) {
    return { events: [], hasMajor: false };
  }

  const majorsText = user.majors.join(" ");
  const embedding = await getOrCreateEmbedding(ctx, majorsText, {
    cacheKey: `embedding:user:${options.userId}:majors`,
    ttlSeconds: 60 * 60 * 24, // 24h
  });

  const eventSimilarity = sql<number>`1 - (${cosineDistance(events.embedding, embedding)})`;
  const groupSimilarity = sql<number>`1 - (${cosineDistance(groups.embedding, embedding)})`;

  const result = await ctx.db
    .select({ event: eventPublicColumns, group: groupPublicColumns })
    .from(events)
    .leftJoin(groups, eq(events.groupId, groups.id))
    .where(
      and(
        gte(events.startTime, now),
        eq(events.status, "PUBLISHED"),
        or(
          and(sql`${events.embedding} IS NOT NULL`, gt(eventSimilarity, 0.3)),
          and(sql`${groups.embedding} IS NOT NULL`, gt(groupSimilarity, 0.3)),
        ),
      ),
    )
    .orderBy(asc(events.startTime))
    .limit(limit)
    .offset(offset);

  return { events: result, hasMajor: true };
};

export const getInterestFeed = async (
  ctx: ServiceContext,
  options: {
    interest: string;
    limit?: number;
    offset?: number;
  },
) => {
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;
  const now = new Date();

  const searchText = getInterestSearchText(options.interest);
  const normalizedInterest = options.interest.trim();
  const embedding = await getOrCreateEmbedding(ctx, searchText, {
    cacheKey: `embedding:interest:${normalizedInterest}`,
    ttlSeconds: 60 * 60 * 24 * 7, // 7 days
  });

  const eventSimilarity = sql<number>`1 - (${cosineDistance(events.embedding, embedding)})`;
  const groupSimilarity = sql<number>`1 - (${cosineDistance(groups.embedding, embedding)})`;

  const result = await ctx.db
    .select({ event: eventPublicColumns, group: groupPublicColumns })
    .from(events)
    .leftJoin(groups, eq(events.groupId, groups.id))
    .where(
      and(
        gte(events.startTime, now),
        eq(events.status, "PUBLISHED"),
        or(
          and(sql`${events.embedding} IS NOT NULL`, gt(eventSimilarity, 0.3)),
          and(sql`${groups.embedding} IS NOT NULL`, gt(groupSimilarity, 0.3)),
        ),
      ),
    )
    .orderBy(asc(events.startTime))
    .limit(limit)
    .offset(offset);

  return result;
};

export const getInterestsFeed = async (
  ctx: ServiceContext,
  options: {
    userId: string;
    limit?: number;
    offset?: number;
  },
) => {
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;
  const now = new Date();

  const [user] = await ctx.db
    .select({ interests: users.interests })
    .from(users)
    .where(eq(users.id, options.userId))
    .limit(1);

  if (!user?.interests || user.interests.length === 0) {
    return { events: [], hasInterests: false };
  }

  const interestsText = user.interests.map((i) => getInterestSearchText(i)).join(" ");
  const embedding = await getOrCreateEmbedding(ctx, interestsText, {
    cacheKey: `embedding:user:${options.userId}:interests`,
    ttlSeconds: 60 * 60 * 24, // 24h
  });

  const eventSimilarity = sql<number>`1 - (${cosineDistance(events.embedding, embedding)})`;
  const groupSimilarity = sql<number>`1 - (${cosineDistance(groups.embedding, embedding)})`;

  const result = await ctx.db
    .select({ event: eventPublicColumns, group: groupPublicColumns })
    .from(events)
    .leftJoin(groups, eq(events.groupId, groups.id))
    .where(
      and(
        gte(events.startTime, now),
        eq(events.status, "PUBLISHED"),
        or(
          and(sql`${events.embedding} IS NOT NULL`, gt(eventSimilarity, 0.3)),
          and(sql`${groups.embedding} IS NOT NULL`, gt(groupSimilarity, 0.3)),
        ),
      ),
    )
    .orderBy(asc(events.startTime))
    .limit(limit)
    .offset(offset);

  return { events: result, hasInterests: true };
};

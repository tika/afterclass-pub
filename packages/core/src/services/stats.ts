import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { ServiceContext } from "./context";
import {
  eventPublicColumns,
  events,
  groupFollows,
  groupPublicColumns,
  groups,
  users,
} from "@afterclass/core/db/schema";

export const getStats = async (ctx: ServiceContext) => {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const twentyFourHoursAgo = new Date(now);
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(now);
  weekEnd.setHours(23, 59, 59, 999);

  // Core Health Metrics
  const totalUsersResult = await ctx.db.select({ count: count() }).from(users);
  const totalUsers = totalUsersResult[0]?.count || 0;

  const newUsers24hResult = await ctx.db
    .select({ count: count() })
    .from(users)
    .where(gte(users.createdAt, twentyFourHoursAgo));
  const newUsers24h = newUsers24hResult[0]?.count || 0;

  const newUsers7dResult = await ctx.db
    .select({ count: count() })
    .from(users)
    .where(gte(users.createdAt, sevenDaysAgo));
  const newUsers7d = newUsers7dResult[0]?.count || 0;

  const totalGroupsResult = await ctx.db.select({ count: count() }).from(groups);
  const totalGroups = totalGroupsResult[0]?.count || 0;

  const totalEventsResult = await ctx.db.select({ count: count() }).from(events);
  const totalEvents = totalEventsResult[0]?.count || 0;

  const eventsTodayResult = await ctx.db
    .select({ count: count() })
    .from(events)
    .where(
      and(
        gte(events.startTime, todayStart),
        lte(events.startTime, todayEnd),
        eq(events.status, "PUBLISHED"),
      ),
    );
  const eventsToday = eventsTodayResult[0]?.count || 0;

  const eventsThisWeekResult = await ctx.db
    .select({ count: count() })
    .from(events)
    .where(
      and(
        gte(events.startTime, weekStart),
        lte(events.startTime, weekEnd),
        eq(events.status, "PUBLISHED"),
      ),
    );
  const eventsThisWeek = eventsThisWeekResult[0]?.count || 0;

  // Note: Active users requires login tracking - for now return 0
  const activeUsers7d = 0;

  // Content Metrics - Events by status
  const eventsByStatusResult = await ctx.db
    .select({
      status: events.status,
      count: count(),
    })
    .from(events)
    .groupBy(events.status);

  const eventsByStatus = {
    DRAFT: 0,
    PUBLISHED: 0,
    CANCELLED: 0,
    ARCHIVED: 0,
  };

  for (const row of eventsByStatusResult) {
    if (row.status) {
      eventsByStatus[row.status as keyof typeof eventsByStatus] = row.count;
    }
  }

  // Organizations with most followers (top 10)
  const topOrganizationsByFollowers = await ctx.db
    .select({
      groupId: groupFollows.groupId,
      followerCount: count(),
    })
    .from(groupFollows)
    .groupBy(groupFollows.groupId)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  const topOrgsWithDetails = await Promise.all(
    topOrganizationsByFollowers.map(async (org) => {
      const groupDetails = await ctx.db
        .select(groupPublicColumns)
        .from(groups)
        .where(eq(groups.id, org.groupId))
        .limit(1);
      return {
        ...groupDetails[0],
        followerCount: org.followerCount,
      };
    }),
  );

  // Most active organizations (by event count)
  const topOrganizationsByEvents = await ctx.db
    .select({
      groupId: events.groupId,
      eventCount: count(),
    })
    .from(events)
    .groupBy(events.groupId)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  const topOrgsByEventsWithDetails = await Promise.all(
    topOrganizationsByEvents.map(async (org) => {
      const groupDetails = await ctx.db
        .select(groupPublicColumns)
        .from(groups)
        .where(eq(groups.id, org.groupId))
        .limit(1);
      return {
        ...groupDetails[0],
        eventCount: org.eventCount,
      };
    }),
  );

  // Growth Indicators - User growth trend (last 7 days)
  const userGrowthTrend = await ctx.db
    .select({
      date: sql<string>`DATE(${users.createdAt})`,
      count: count(),
    })
    .from(users)
    .where(gte(users.createdAt, sevenDaysAgo))
    .groupBy(sql`DATE(${users.createdAt})`)
    .orderBy(sql`DATE(${users.createdAt})`);

  // Event creation trend (last 7 days)
  const eventCreationTrend = await ctx.db
    .select({
      date: sql<string>`DATE(${events.createdAt})`,
      count: count(),
    })
    .from(events)
    .where(gte(events.createdAt, sevenDaysAgo))
    .groupBy(sql`DATE(${events.createdAt})`)
    .orderBy(sql`DATE(${events.createdAt})`);

  // New organizations (last 7 days)
  const newOrganizations7dResult = await ctx.db
    .select({ count: count() })
    .from(groups)
    .where(gte(groups.createdAt, sevenDaysAgo));
  const newOrganizations7d = newOrganizations7dResult[0]?.count || 0;

  // Quick Alerts - Events happening today
  const eventsHappeningToday = await ctx.db
    .select({
      event: eventPublicColumns,
      group: groupPublicColumns,
    })
    .from(events)
    .leftJoin(groups, eq(events.groupId, groups.id))
    .where(
      and(
        gte(events.startTime, todayStart),
        lte(events.startTime, todayEnd),
        eq(events.status, "PUBLISHED"),
      ),
    )
    .orderBy(events.startTime)
    .limit(20);

  // Recently created accounts (last 24h)
  const recentlyCreatedAccounts = await ctx.db
    .select()
    .from(users)
    .where(gte(users.createdAt, twentyFourHoursAgo))
    .orderBy(desc(users.createdAt))
    .limit(20);

  // Recently created organizations (last 24h)
  const recentlyCreatedOrganizations = await ctx.db
    .select(groupPublicColumns)
    .from(groups)
    .where(gte(groups.createdAt, twentyFourHoursAgo))
    .orderBy(desc(groups.createdAt))
    .limit(20);

  return {
    // Core Health Metrics
    totalUsers,
    newUsers24h,
    newUsers7d,
    totalGroups,
    totalEvents,
    eventsToday,
    eventsThisWeek,
    activeUsers7d,

    // Content Metrics
    eventsByStatus,
    topGroupsByFollowers: topOrgsWithDetails,
    topGroupsByEvents: topOrgsByEventsWithDetails,

    // Growth Indicators
    userGrowthTrend: userGrowthTrend.map((row) => ({
      date: row.date,
      count: row.count,
    })),
    eventCreationTrend: eventCreationTrend.map((row) => ({
      date: row.date,
      count: row.count,
    })),
    newGroups7d: newOrganizations7d,

    // Quick Alerts
    eventsHappeningToday,
    recentlyCreatedAccounts,
    recentlyCreatedGroups: recentlyCreatedOrganizations,
  };
};

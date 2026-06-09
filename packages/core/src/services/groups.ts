import type { InferInsertModel } from "drizzle-orm";
import {
  and,
  asc,
  cosineDistance,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lte,
  notInArray,
  sql,
} from "drizzle-orm";
import type { z } from "zod";
import { compareTwoStrings } from "@afterclass/core/lib/stringSimilarity";
import { slugify } from "@afterclass/core/lib/slug";
import {
  eventPublicColumns,
  eventReminders,
  events,
  groupFollows,
  groupMembers,
  groupPublicColumns,
  groups,
  users,
} from "@afterclass/core/db/schema";
import { eventBus } from "@afterclass/core/events";
import type {
  GroupCreated,
  GroupUpdated,
  GroupDeleted,
  GroupMemberAdded,
  GroupMemberRemoved,
  GroupMemberRoleChanged,
  GroupFollowed,
  GroupUnfollowed,
} from "@afterclass/core/schemas/domain-events";
import { sendGroupInvitationEmail } from "@afterclass/core/lib/email";
import { generateGroupEmbedding, getOrCreateEmbedding } from "@afterclass/core/services/embeddings";
import { getInterestSearchText } from "@afterclass/core/services/interestKeywords";
import type { ServiceContext } from "@afterclass/core/services/context";
import type { createGroupSchema, updateGroupSchema } from "@afterclass/core/schemas/groups";
import type { Group, GroupMemberRole } from "@afterclass/core/types";

// DB-specific types (for insert operations)
type GroupInsert = InferInsertModel<typeof groups>;

// Input types derived from Zod schemas
type CreateGroupInput = z.infer<typeof createGroupSchema>;
type UpdateGroupInput = Omit<z.infer<typeof updateGroupSchema>, "id">;
type GetGroupsOptions = {
  search?: string;
  limit?: number;
  offset?: number;
};

// Query functions
export const getGroups = async (ctx: ServiceContext, options: GetGroupsOptions = {}) => {
  const { search, limit = 20, offset = 0 } = options;

  const query = ctx.db.select(groupPublicColumns).from(groups);

  if (search) {
    return await query
      .where(ilike(groups.name, `%${search}%`))
      .limit(limit)
      .offset(offset)
      .orderBy(groups.name);
  }

  return await query.limit(limit).offset(offset).orderBy(groups.name);
};

export const getMajorGroups = async (
  ctx: ServiceContext,
  options: {
    userId: string;
    limit?: number;
    offset?: number;
  },
) => {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const [user] = await ctx.db
    .select({ majors: users.majors })
    .from(users)
    .where(eq(users.id, options.userId))
    .limit(1);

  if (!user?.majors || user.majors.length === 0) {
    return { groups: [], hasMajor: false };
  }

  const majorsText = user.majors.join(" ");
  const embedding = await getOrCreateEmbedding(ctx, majorsText, {
    cacheKey: `embedding:user:${options.userId}:majors`,
    ttlSeconds: 60 * 60 * 24, // 24h
  });

  const similarity = sql<number>`1 - (${cosineDistance(groups.embedding, embedding)})`;

  const result = await ctx.db
    .select(groupPublicColumns)
    .from(groups)
    .where(and(sql`${groups.embedding} IS NOT NULL`, gt(similarity, 0.3)))
    .orderBy(desc(similarity))
    .limit(limit)
    .offset(offset);

  return { groups: result, hasMajor: true };
};

export const getInterestGroups = async (
  ctx: ServiceContext,
  options: {
    userId: string;
    limit?: number;
    offset?: number;
  },
) => {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const [user] = await ctx.db
    .select({ interests: users.interests })
    .from(users)
    .where(eq(users.id, options.userId))
    .limit(1);

  if (!user?.interests || user.interests.length === 0) {
    return { groups: [], hasInterests: false };
  }

  const interestsText = user.interests.map((i) => getInterestSearchText(i)).join(" ");
  const embedding = await getOrCreateEmbedding(ctx, interestsText, {
    cacheKey: `embedding:user:${options.userId}:interests`,
    ttlSeconds: 60 * 60 * 24, // 24h
  });

  const similarity = sql<number>`1 - (${cosineDistance(groups.embedding, embedding)})`;

  const result = await ctx.db
    .select(groupPublicColumns)
    .from(groups)
    .where(and(sql`${groups.embedding} IS NOT NULL`, gt(similarity, 0.3)))
    .orderBy(desc(similarity))
    .limit(limit)
    .offset(offset);

  return { groups: result, hasInterests: true };
};

export const getGroupsByInterest = async (
  ctx: ServiceContext,
  options: {
    interest: string;
    limit?: number;
    offset?: number;
  },
) => {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const searchText = getInterestSearchText(options.interest);
  const normalizedInterest = options.interest.trim();
  const embedding = await getOrCreateEmbedding(ctx, searchText, {
    cacheKey: `embedding:interest:${normalizedInterest}`,
    ttlSeconds: 60 * 60 * 24 * 7, // 7 days
  });

  const similarity = sql<number>`1 - (${cosineDistance(groups.embedding, embedding)})`;

  const result = await ctx.db
    .select(groupPublicColumns)
    .from(groups)
    .where(and(sql`${groups.embedding} IS NOT NULL`, gt(similarity, 0.3)))
    .orderBy(desc(similarity))
    .limit(limit)
    .offset(offset);

  return result;
};

/**
 * Returns up to 3 group suggestions for the user, based on interests (or majors as fallback).
 * Excludes groups the user already follows.
 */
export const getSuggestedGroups = async (
  ctx: ServiceContext,
  options: { userId: string; limit?: number },
) => {
  const limit = options.limit ?? 3;

  const followedRows = await ctx.db
    .select({ groupId: groupFollows.groupId })
    .from(groupFollows)
    .where(eq(groupFollows.userId, options.userId));
  const excludeIds = followedRows.map((r) => r.groupId);

  let result: { id: string }[] = [];

  const interestResult = await getInterestGroups(ctx, {
    userId: options.userId,
    limit: limit + excludeIds.length + 5,
    offset: 0,
  });

  if (interestResult.groups.length > 0) {
    result = interestResult.groups
      .filter((g) => !excludeIds.includes(g.id))
      .slice(0, limit)
      .map((g) => ({ id: g.id }));
  }

  if (result.length < limit) {
    const majorResult = await getMajorGroups(ctx, {
      userId: options.userId,
      limit: limit + excludeIds.length + 5,
      offset: 0,
    });
    const extra = majorResult.groups
      .filter((g) => !excludeIds.includes(g.id) && !result.some((r) => r.id === g.id))
      .slice(0, limit - result.length)
      .map((g) => ({ id: g.id }));
    result = [...result, ...extra];
  }

  if (result.length < limit) {
    const alreadyIds = [...excludeIds, ...result.map((r) => r.id)];
    const all = await ctx.db
      .select(groupPublicColumns)
      .from(groups)
      .where(alreadyIds.length > 0 ? notInArray(groups.id, alreadyIds) : sql`true`)
      .limit(limit - result.length + 10)
      .orderBy(desc(groups.createdAt));
    const extra = all.slice(0, limit - result.length).map((g) => ({ id: g.id }));
    result = [...result, ...extra];
  }

  if (result.length === 0) {
    return { groups: [] };
  }

  const groupsList = await ctx.db
    .select(groupPublicColumns)
    .from(groups)
    .where(
      inArray(
        groups.id,
        result.map((r) => r.id),
      ),
    );

  const order = result.map((r) => r.id);
  const ordered = order
    .map((id) => groupsList.find((g) => g.id === id))
    .filter((g): g is NonNullable<typeof g> => g != null);

  return { groups: ordered };
};

export const getGroup = async (ctx: ServiceContext, groupId: string, userId?: string) => {
  const [group] = await ctx.db
    .select(groupPublicColumns)
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (!group) {
    throw new Error("Group not found");
  }

  const upcomingEvents = await ctx.db
    .select(eventPublicColumns)
    .from(events)
    .where(eq(events.groupId, groupId))
    .orderBy(events.startTime)
    .limit(10);

  // Check if user is following this group
  let isFollowing = false;
  if (userId) {
    const [follow] = await ctx.db
      .select()
      .from(groupFollows)
      .where(and(eq(groupFollows.userId, userId), eq(groupFollows.groupId, groupId)))
      .limit(1);
    isFollowing = !!follow;
  }

  return {
    group,
    upcomingEvents,
    isFollowing,
  };
};

export const getGroupBySlug = async (ctx: ServiceContext, slug: string, currentUserId?: string) => {
  const result = await ctx.db
    .select(groupPublicColumns)
    .from(groups)
    .where(eq(groups.slug, slug))
    .limit(1);

  if (result.length === 0) {
    throw new Error("Group not found");
  }

  const group = result[0]!;

  // Get upcoming events
  const upcomingEvents = await ctx.db
    .select({ event: eventPublicColumns })
    .from(events)
    .where(and(eq(events.groupId, group.id), gte(events.startTime, new Date())))
    .orderBy(asc(events.startTime))
    .limit(10);

  // Check if current user is following
  let isFollowing = false;
  if (currentUserId) {
    const follow = await ctx.db
      .select()
      .from(groupFollows)
      .where(and(eq(groupFollows.groupId, group.id), eq(groupFollows.userId, currentUserId)))
      .limit(1);
    isFollowing = follow.length > 0;
  }

  return { group, upcomingEvents, isFollowing };
};

export const getAllGroups = async (ctx: ServiceContext) => {
  return await ctx.db.select(groupPublicColumns).from(groups).orderBy(desc(groups.createdAt));
};

/**
 * Fuzzy match an organization name string to a group in the database.
 * Uses application-level string similarity (no raw SQL).
 * Returns the best match if confidence exceeds the threshold.
 */
const FUZZY_MATCH_THRESHOLD = 0.4;

export const fuzzyMatchGroup = async (ctx: ServiceContext, orgName: string) => {
  if (!orgName || typeof orgName !== "string" || orgName.trim().length === 0) {
    return { group: null, confidence: 0 };
  }

  const allGroups = await ctx.db.select(groupPublicColumns).from(groups);

  if (allGroups.length === 0) {
    return { group: null, confidence: 0 };
  }

  const normalizedInput = orgName.trim().toLowerCase();
  let bestMatch: Group | null = null;
  let bestScore = 0;

  for (const group of allGroups) {
    const normalizedName = group.name.trim().toLowerCase();
    const score = compareTwoStrings(normalizedInput, normalizedName);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = group as unknown as unknown as Group;
    }
  }

  if (bestScore < FUZZY_MATCH_THRESHOLD || !bestMatch) {
    return { group: null, confidence: bestScore };
  }

  return { group: bestMatch, confidence: bestScore };
};

// Mutation functions
export const createGroup = async (
  ctx: ServiceContext,
  data: CreateGroupInput,
  adminUserId: string,
): Promise<Group> => {
  const baseSlug = slugify(data.name);
  let slug = baseSlug;
  let counter = 2;
  while (true) {
    const existing = await ctx.db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.slug, slug))
      .limit(1);
    if (existing.length === 0) break;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  const insertData = {
    name: data.name,
    slug,
    ...(data.bio !== undefined && data.bio !== null && { bio: data.bio }),
    ...(data.logoUrl !== undefined && data.logoUrl !== null && { logoUrl: data.logoUrl }),
    ...(data.bannerUrl !== undefined && data.bannerUrl !== null && { bannerUrl: data.bannerUrl }),
    ...(data.instagram !== undefined && data.instagram !== null && { instagram: data.instagram }),
    ...(data.website !== undefined && data.website !== null && { website: data.website }),
    ...(data.categories !== undefined &&
      data.categories !== null && { categories: data.categories }),
    ...(data.isVerified !== undefined && { isVerified: data.isVerified }),
  };

  const [group] = await ctx.db.insert(groups).values(insertData).returning();

  if (!group) {
    throw new Error("Failed to create group");
  }

  try {
    const embedding = await generateGroupEmbedding(ctx, group);
    await ctx.db.update(groups).set({ embedding }).where(eq(groups.id, group.id));
  } catch {
    // Non-fatal: embedding generation can fail (e.g., no API key)
  }

  // Add creator as ADMIN
  await ctx.db.insert(groupMembers).values({
    groupId: group.id,
    userId: adminUserId,
    role: "ADMIN",
  });

  await eventBus.emit<GroupCreated>({
    type: "GroupCreated",
    payload: {
      groupId: group.id,
      createdBy: adminUserId,
    },
  });

  const { embedding: _e, ...groupPublic } = group;
  return groupPublic as unknown as unknown as Group;
};

export const updateGroup = async (
  ctx: ServiceContext,
  groupId: string,
  data: UpdateGroupInput,
  adminUserId: string,
): Promise<Group> => {
  const updateData: Partial<GroupInsert> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.bio !== undefined) updateData.bio = data.bio;
  if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
  if (data.bannerUrl !== undefined) updateData.bannerUrl = data.bannerUrl;
  if (data.instagram !== undefined) updateData.instagram = data.instagram;
  if (data.website !== undefined) updateData.website = data.website;
  if (data.categories !== undefined) updateData.categories = data.categories;
  if (data.isVerified !== undefined) updateData.isVerified = data.isVerified;

  if (Object.keys(updateData).length === 0) {
    throw new Error("No fields to update");
  }

  const [group] = await ctx.db
    .update(groups)
    .set(updateData)
    .where(eq(groups.id, groupId))
    .returning();

  if (!group) {
    throw new Error("Group not found");
  }

  const changedFields = Object.keys(updateData);
  await eventBus.emit<GroupUpdated>({
    type: "GroupUpdated",
    payload: {
      groupId,
      updatedBy: adminUserId,
      changedFields,
    },
  });

  const { embedding: _e, ...groupPublic } = group;
  return groupPublic as unknown as Group;
};

export const deleteGroup = async (
  ctx: ServiceContext,
  groupId: string,
  adminUserId: string,
): Promise<Group> => {
  const [group] = await ctx.db.delete(groups).where(eq(groups.id, groupId)).returning();

  if (!group) {
    throw new Error("Group not found");
  }

  await eventBus.emit<GroupDeleted>({
    type: "GroupDeleted",
    payload: { groupId, deletedBy: adminUserId },
  });

  const { embedding: _e, ...groupPublic } = group;
  return groupPublic as unknown as Group;
};

// Membership functions
export const addGroupMember = async (
  ctx: ServiceContext,
  groupId: string,
  userIdOrEmail: string,
  role: GroupMemberRole,
  addedByUserId: string,
  skipAdminCheck: boolean = false,
  isEmail: boolean = false,
) => {
  // Skip admin check for super admins
  if (!skipAdminCheck) {
    await ensureGroupAdmin(ctx, groupId, addedByUserId);
  }

  let userId: string;

  // If email is provided, look up user by email
  if (isEmail) {
    const [user] = await ctx.db.select().from(users).where(eq(users.email, userIdOrEmail)).limit(1);

    if (!user) {
      // User doesn't exist - send invitation email
      const [group] = await ctx.db.select().from(groups).where(eq(groups.id, groupId)).limit(1);

      if (!group) {
        throw new Error("Group not found");
      }

      // Get inviter name
      const [inviter] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.id, addedByUserId))
        .limit(1);

      // Send invitation email
      await sendGroupInvitationEmail({
        email: userIdOrEmail,
        groupName: group.name,
        inviterName: inviter?.name || undefined,
      });

      // Return a special response indicating invitation was sent
      // We'll handle this in the router to return appropriate response
      throw new Error("INVITATION_SENT");
    }

    userId = user.id;
  } else {
    userId = userIdOrEmail;
  }

  // Check if user is already a member
  const existingMember = await ctx.db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);

  if (existingMember.length > 0) {
    // Update existing member's role
    const [member] = await ctx.db
      .update(groupMembers)
      .set({ role })
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
      .returning();

    if (!member) {
      throw new Error("Failed to update group member");
    }

    return member;
  }

  const [member] = await ctx.db
    .insert(groupMembers)
    .values({
      groupId,
      userId,
      role,
    })
    .returning();

  if (!member) {
    throw new Error("Failed to add group member");
  }

  await eventBus.emit<GroupMemberAdded>({
    type: "GroupMemberAdded",
    payload: { groupId, userId, role, addedBy: addedByUserId },
  });

  return member;
};

export const removeGroupMember = async (
  ctx: ServiceContext,
  groupId: string,
  userId: string,
  removedByUserId: string,
  skipAdminCheck: boolean = false,
) => {
  // Skip admin check for super admins
  if (!skipAdminCheck) {
    await ensureGroupAdmin(ctx, groupId, removedByUserId);
  }

  const [member] = await ctx.db
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .returning();

  if (!member) {
    throw new Error("Group member not found");
  }

  await eventBus.emit<GroupMemberRemoved>({
    type: "GroupMemberRemoved",
    payload: { groupId, userId, removedBy: removedByUserId },
  });

  return member;
};

export const updateGroupMemberRole = async (
  ctx: ServiceContext,
  groupId: string,
  userId: string,
  newRole: GroupMemberRole,
  updatedByUserId: string,
) => {
  await ensureGroupAdmin(ctx, groupId, updatedByUserId);

  // Fetch current role for the event payload
  const [existing] = await ctx.db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);

  if (!existing) {
    throw new Error("Group member not found");
  }

  const oldRole = existing.role as GroupMemberRole;

  const [member] = await ctx.db
    .update(groupMembers)
    .set({ role: newRole })
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .returning();

  if (!member) {
    throw new Error("Group member not found");
  }

  await eventBus.emit<GroupMemberRoleChanged>({
    type: "GroupMemberRoleChanged",
    payload: { groupId, userId, oldRole, newRole, changedBy: updatedByUserId },
  });

  return member;
};

// Query membership functions
export const getGroupMembers = async (ctx: ServiceContext, groupId: string) => {
  return await ctx.db
    .select({
      member: groupMembers,
      user: users,
    })
    .from(groupMembers)
    .leftJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, groupId));
};

export const getGroupFollowers = async (ctx: ServiceContext, groupId: string) => {
  return await ctx.db
    .select({
      follow: groupFollows,
      user: users,
    })
    .from(groupFollows)
    .leftJoin(users, eq(groupFollows.userId, users.id))
    .where(eq(groupFollows.groupId, groupId))
    .orderBy(desc(groupFollows.createdAt));
};

export const getGroupAdmins = async (ctx: ServiceContext, groupId: string) => {
  return await ctx.db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.role, "ADMIN")));
};

export const getUserGroups = async (ctx: ServiceContext, userId: string) => {
  return await ctx.db
    .select({
      group: groupPublicColumns,
      membership: groupMembers,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(eq(groupMembers.userId, userId));
};

export const getUserAdminGroups = async (ctx: ServiceContext, userId: string) => {
  return await ctx.db
    .select({
      group: groupPublicColumns,
      membership: groupMembers,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(and(eq(groupMembers.userId, userId), eq(groupMembers.role, "ADMIN")));
};

// Helper functions
export const isGroupMember = async (
  ctx: ServiceContext,
  groupId: string,
  userId: string,
): Promise<boolean> => {
  const [result] = await ctx.db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);

  return !!result;
};

export const isGroupAdmin = async (
  ctx: ServiceContext,
  groupId: string,
  userId: string,
): Promise<boolean> => {
  const [result] = await ctx.db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId),
        eq(groupMembers.role, "ADMIN"),
      ),
    )
    .limit(1);

  return !!result;
};

const ensureGroupAdmin = async (
  ctx: ServiceContext,
  groupId: string,
  userId: string,
): Promise<void> => {
  const isAdmin = await isGroupAdmin(ctx, groupId, userId);
  if (!isAdmin) {
    throw new Error("Only group admins can perform this action");
  }
};

// Stats functions
export const getGroupStats = async (ctx: ServiceContext, groupId: string) => {
  const now = new Date();
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // Count total followers
  const followersResult = await ctx.db
    .select({ count: count() })
    .from(groupFollows)
    .where(eq(groupFollows.groupId, groupId));
  const followers = followersResult[0]?.count || 0;

  // Count new followers this week (for trend)
  const newFollowersResult = await ctx.db
    .select({ count: count() })
    .from(groupFollows)
    .where(and(eq(groupFollows.groupId, groupId), gte(groupFollows.createdAt, oneWeekAgo)));
  const followersChange = newFollowersResult[0]?.count || 0;

  // Count total engagement: reminders on upcoming events
  const engagementResult = await ctx.db
    .select({ count: count() })
    .from(eventReminders)
    .innerJoin(events, eq(eventReminders.eventId, events.id))
    .where(and(eq(events.groupId, groupId), gte(events.startTime, now)));
  const engagement = engagementResult[0]?.count || 0;

  // Count new reminders this week (for engagement trend)
  const newEngagementResult = await ctx.db
    .select({ count: count() })
    .from(eventReminders)
    .innerJoin(events, eq(eventReminders.eventId, events.id))
    .where(
      and(
        eq(events.groupId, groupId),
        gte(events.startTime, now),
        gte(eventReminders.createdAt, oneWeekAgo),
      ),
    );
  const engagementChange = newEngagementResult[0]?.count || 0;

  // Calculate campus rank: position in leaderboard sorted by engagement
  // Get all groups with their engagement counts
  const allGroupsEngagement = await ctx.db
    .select({
      groupId: events.groupId,
      engagementCount: count(),
    })
    .from(eventReminders)
    .innerJoin(events, eq(eventReminders.eventId, events.id))
    .where(gte(events.startTime, now))
    .groupBy(events.groupId)
    .orderBy(desc(count()));

  // Find rank of this group
  let campusRank = 0;
  let category = "All Groups";
  for (let i = 0; i < allGroupsEngagement.length; i++) {
    if (allGroupsEngagement[i]?.groupId === groupId) {
      campusRank = i + 1;
      break;
    }
  }

  // If group not found in leaderboard, rank is total groups + 1
  if (campusRank === 0) {
    const totalGroupsResult = await ctx.db.select({ count: count() }).from(groups);
    campusRank = (totalGroupsResult[0]?.count || 0) + 1;
  }

  // Category is now always "All Groups" since groupType was removed
  category = "All Groups";

  return {
    followers,
    followersChange,
    engagement,
    engagementChange,
    campusRank,
    category,
  };
};

const TRENDING_RANKINGS_CACHE_TTL = 60 * 5; // 5 minutes

export const getTrendingGroups = async (ctx: ServiceContext, limit: number = 5) => {
  const cacheKey = `cache:trending:${limit}`;
  try {
    const cached = await ctx.redis.get<string>(cacheKey);
    if (cached) {
      return JSON.parse(cached) as Awaited<ReturnType<typeof getTrendingGroupsUncached>>;
    }
  } catch {
    // Redis unavailable — proceed to DB
  }

  const result = await getTrendingGroupsUncached(ctx, limit);

  try {
    await ctx.redis.set(cacheKey, JSON.stringify(result), { ex: TRENDING_RANKINGS_CACHE_TTL });
  } catch {
    // Non-fatal
  }

  return result;
};

async function getTrendingGroupsUncached(ctx: ServiceContext, limit: number) {
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);

  // Get top groups by engagement (reminders) on events this week
  const trendingGroups = await ctx.db
    .select({
      groupId: events.groupId,
      engagementCount: count(),
    })
    .from(eventReminders)
    .innerJoin(events, eq(eventReminders.eventId, events.id))
    .where(and(gte(events.startTime, now), lte(events.startTime, weekEnd)))
    .groupBy(events.groupId)
    .orderBy(desc(count()))
    .limit(limit);

  // Get group details for each trending group
  const groupIds = trendingGroups.map((tg) => tg.groupId).filter(Boolean) as string[];

  if (groupIds.length === 0) {
    return [];
  }

  const groupDetails = await ctx.db
    .select(groupPublicColumns)
    .from(groups)
    .where(inArray(groups.id, groupIds));

  // Combine engagement counts with group details
  return trendingGroups
    .map((tg) => {
      const group = groupDetails.find((g) => g.id === tg.groupId);
      return {
        ...group,
        engagementCount: tg.engagementCount,
      };
    })
    .filter((item) => item.id); // Filter out any groups not found
}

export const getCampusRankings = async (ctx: ServiceContext, limit: number = 10) => {
  const cacheKey = `cache:rankings:${limit}`;
  try {
    const cached = await ctx.redis.get<string>(cacheKey);
    if (cached) {
      return JSON.parse(cached) as Awaited<ReturnType<typeof getCampusRankingsUncached>>;
    }
  } catch {
    // Redis unavailable — proceed to DB
  }

  const result = await getCampusRankingsUncached(ctx, limit);

  try {
    await ctx.redis.set(cacheKey, JSON.stringify(result), { ex: TRENDING_RANKINGS_CACHE_TTL });
  } catch {
    // Non-fatal
  }

  return result;
};

async function getCampusRankingsUncached(ctx: ServiceContext, limit: number) {
  const now = new Date();

  // Get all groups with engagement counts using a subquery
  // This ensures we include all groups, even those with 0 engagement
  const allGroupsWithEngagement = await ctx.db
    .select({
      id: groups.id,
      name: groups.name,
      bio: groups.bio,
      logoUrl: groups.logoUrl,
      bannerUrl: groups.bannerUrl,
      instagram: groups.instagram,
      website: groups.website,
      createdAt: groups.createdAt,
      updatedAt: groups.updatedAt,
      engagementCount: sql<number>`
				COALESCE((
					SELECT COUNT(*)
					FROM ${eventReminders}
					INNER JOIN ${events} ON ${eventReminders.eventId} = ${events.id}
					WHERE ${events.groupId} = ${groups.id}
					AND ${events.startTime} >= ${now}
				), 0)
			`,
    })
    .from(groups)
    .orderBy(
      desc(sql`
			COALESCE((
				SELECT COUNT(*)
				FROM ${eventReminders}
				INNER JOIN ${events} ON ${eventReminders.eventId} = ${events.id}
				WHERE ${events.groupId} = ${groups.id}
				AND ${events.startTime} >= ${now}
			), 0)
		`),
    )
    .limit(limit);

  // Add rank
  return allGroupsWithEngagement.map((group, index) => ({
    ...group,
    engagementCount: Number(group.engagementCount) || 0,
    rank: index + 1,
  }));
}

export const getGroupEngagementDetails = async (ctx: ServiceContext, groupId: string) => {
  const now = new Date();

  // Get total reminders count
  const totalRemindersResult = await ctx.db
    .select({ count: count() })
    .from(eventReminders)
    .innerJoin(events, eq(eventReminders.eventId, events.id))
    .where(and(eq(events.groupId, groupId), gte(events.startTime, now)));
  const totalReminders = totalRemindersResult[0]?.count || 0;

  // Get upcoming events with reminder counts
  const eventsWithReminders = await ctx.db
    .select({
      eventId: events.id,
      eventTitle: events.title,
      eventStartTime: events.startTime,
      eventLocationName: events.locationName,
      reminderCount: sql<number>`COALESCE(COUNT(*), 0)`,
    })
    .from(events)
    .leftJoin(eventReminders, eq(eventReminders.eventId, events.id))
    .where(and(eq(events.groupId, groupId), gte(events.startTime, now)))
    .groupBy(events.id, events.title, events.startTime, events.locationName)
    .orderBy(events.startTime);

  return {
    totalReminders,
    events: eventsWithReminders.map((e) => ({
      id: e.eventId,
      title: e.eventTitle,
      startTime: e.eventStartTime,
      locationName: e.eventLocationName,
      reminderCount: Number(e.reminderCount) || 0,
    })),
  };
};

// Follow/Unfollow functions
export const followGroup = async (ctx: ServiceContext, groupId: string, userId: string) => {
  // Check if already following
  const [existing] = await ctx.db
    .select()
    .from(groupFollows)
    .where(and(eq(groupFollows.userId, userId), eq(groupFollows.groupId, groupId)))
    .limit(1);

  if (existing) {
    return { success: true, alreadyFollowing: true };
  }

  await ctx.db.insert(groupFollows).values({
    userId,
    groupId,
  });

  await eventBus.emit<GroupFollowed>({
    type: "GroupFollowed",
    payload: { groupId, userId },
  });

  return { success: true };
};

export const unfollowGroup = async (ctx: ServiceContext, groupId: string, userId: string) => {
  await ctx.db
    .delete(groupFollows)
    .where(and(eq(groupFollows.userId, userId), eq(groupFollows.groupId, groupId)));

  await eventBus.emit<GroupUnfollowed>({
    type: "GroupUnfollowed",
    payload: { groupId, userId },
  });

  return { success: true };
};

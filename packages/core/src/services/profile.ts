import { and, desc, eq, ilike, or } from "drizzle-orm";
import type { ServiceContext } from "./context";
import {
  groupFollows,
  groupMembers,
  groupPublicColumns,
  groups,
  scheduledNotifications,
  users,
} from "@afterclass/core/db/schema";
import { eventBus } from "@afterclass/core/events";
import type {
  ProfileCreated,
  ProfileUpdated,
  ProfileDeleted,
  UserBanned,
} from "@afterclass/core/schemas/domain-events";
import { logger } from "@afterclass/core/lib/logger";

/** Invalidate cached majors embedding when user's majors change. */
async function invalidateMajorsEmbeddingCache(ctx: ServiceContext, userId: string) {
  try {
    await ctx.redis.del(`embedding:user:${userId}:majors`);
    logger.info("Majors embedding cache invalidated", { userId });
  } catch {
    logger.error("Failed to invalidate majors embedding cache", { userId });
    // Non-fatal
  }
}

export const createProfile = async (
  ctx: ServiceContext,
  _userId: string,
  authId: string,
  clerkData: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  },
  onboardingData: {
    name: string;
    gradYear: string;
    majors?: string[];
  },
) => {
  // Check if profile already exists for this authId
  const [existing] = await ctx.db.select().from(users).where(eq(users.authId, authId)).limit(1);

  if (existing) {
    throw new Error("Profile already exists");
  }

  const [profile] = await ctx.db
    .insert(users)
    .values({
      authId,
      email: clerkData.email,
      name: onboardingData.name,
      gradYear: onboardingData.gradYear,
      majors: onboardingData.majors,
    })
    .returning();

  if (!profile) {
    throw new Error("Failed to create profile");
  }

  await eventBus.emit<ProfileCreated>({
    type: "ProfileCreated",
    payload: { userId: profile.id, email: clerkData.email },
  });

  return profile;
};

export const deleteProfileByAuthId = async (ctx: ServiceContext, authId: string) => {
  const [deleted] = await ctx.db.delete(users).where(eq(users.authId, authId)).returning();

  if (!deleted) {
    throw new Error("Profile not found");
  }

  return deleted;
};

/**
 * Complete onboarding for a Better Auth user.
 * Better Auth already created the user row on first sign-in; this updates profile fields.
 */
export const completeOnboarding = async (
  ctx: ServiceContext,
  userId: string,
  data: {
    name: string;
    gradYear: string;
    majors?: string[];
    interests?: string[];
  },
) => {
  const [existing] = await ctx.db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!existing) {
    throw new Error("Profile not found");
  }

  const [updated] = await ctx.db
    .update(users)
    .set({
      name: data.name,
      gradYear: data.gradYear,
      majors: data.majors,
      interests: data.interests,
    })
    .where(eq(users.id, userId))
    .returning();

  if (!updated) {
    throw new Error("Failed to update profile");
  }

  if (data.majors !== undefined) {
    await invalidateMajorsEmbeddingCache(ctx, userId);
  }

  await eventBus.emit<ProfileCreated>({
    type: "ProfileCreated",
    payload: { userId: updated.id, email: updated.email },
  });

  return updated;
};

/** Reset onboarding by clearing profile fields (does not delete the user row). */
export const resetOnboarding = async (ctx: ServiceContext, userId: string) => {
  const [updated] = await ctx.db
    .update(users)
    .set({ name: null, gradYear: null, majors: null, interests: null })
    .where(eq(users.id, userId))
    .returning();

  if (!updated) {
    throw new Error("Profile not found");
  }

  await invalidateMajorsEmbeddingCache(ctx, userId);

  return updated;
};

// Queries

export const getProfile = async (ctx: ServiceContext, userId: string) => {
  const [user] = await ctx.db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    throw new Error("User not found");
  }

  const followedGroups = await ctx.db
    .select({ group: groupPublicColumns })
    .from(groupFollows)
    .innerJoin(groups, eq(groupFollows.groupId, groups.id))
    .where(eq(groupFollows.userId, userId));

  const memberships = await ctx.db
    .select({ group: groupPublicColumns, membership: groupMembers })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(eq(groupMembers.userId, userId));

  return {
    ...user,
    followedGroups: followedGroups.map((f) => f.group),
    memberships: memberships.map((m) => ({
      ...m.group,
      role: m.membership.role,
    })),
  };
};

export const getPublicProfile = async (ctx: ServiceContext, userId: string) => {
  const [user] = await ctx.db
    .select({
      id: users.id,
      name: users.name,
      gradYear: users.gradYear,
      majors: users.majors,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new Error("User not found");
  }

  return user;
};

export const updateProfile = async (
  ctx: ServiceContext,
  userId: string,
  data: {
    name?: string;
    gradYear?: string;
    majors?: string[];
    interests?: string[];
  },
) => {
  const [updated] = await ctx.db.update(users).set(data).where(eq(users.id, userId)).returning();

  if (!updated) {
    throw new Error("User not found");
  }

  if (data.majors !== undefined) {
    await invalidateMajorsEmbeddingCache(ctx, userId);
  }

  await eventBus.emit<ProfileUpdated>({
    type: "ProfileUpdated",
    payload: { userId },
  });

  return updated;
};

export const getUsers = async (
  ctx: ServiceContext,
  options: { search?: string; limit?: number } = {},
) => {
  const limit = options.limit ?? 50;

  if (options.search) {
    // Search both name and email
    return await ctx.db
      .select()
      .from(users)
      .where(
        or(ilike(users.name, `%${options.search}%`), ilike(users.email, `%${options.search}%`)),
      )
      .limit(limit)
      .orderBy(users.name);
  }

  // No search - return most recently created users
  return await ctx.db.select().from(users).limit(limit).orderBy(desc(users.createdAt));
};

export const updateUser = async (
  ctx: ServiceContext,
  userId: string,
  data: { name?: string; gradYear?: string; majors?: string[] },
) => {
  const [updated] = await ctx.db.update(users).set(data).where(eq(users.id, userId)).returning();

  if (!updated) {
    throw new Error("User not found");
  }

  if (data.majors !== undefined) {
    await invalidateMajorsEmbeddingCache(ctx, userId);
  }

  return updated;
};

export const deleteUser = async (ctx: ServiceContext, userId: string) => {
  const [deleted] = await ctx.db.delete(users).where(eq(users.id, userId)).returning();

  if (!deleted) {
    throw new Error("User not found");
  }

  return deleted;
};

export const banUser = async (
  ctx: ServiceContext,
  userId: string,
  isBanned: boolean,
  adminUserId: string,
) => {
  const [updated] = await ctx.db
    .update(users)
    .set({ isBanned })
    .where(eq(users.id, userId))
    .returning();

  if (!updated) {
    throw new Error("User not found");
  }

  await eventBus.emit<UserBanned>({
    type: "UserBanned",
    payload: { userId, isBanned, bannedBy: adminUserId },
  });

  return updated;
};

export const getUserWithRelationships = async (ctx: ServiceContext, userId: string) => {
  const [user] = await ctx.db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    throw new Error("User not found");
  }

  const follows = await ctx.db
    .select({ group: groupPublicColumns })
    .from(groupFollows)
    .innerJoin(groups, eq(groupFollows.groupId, groups.id))
    .where(eq(groupFollows.userId, userId));

  const memberships = await ctx.db
    .select({ group: groupPublicColumns, membership: groupMembers })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(eq(groupMembers.userId, userId));

  return {
    ...user,
    follows: follows.map((f) => f.group),
    memberships: memberships.map((m) => ({
      ...m.group,
      role: m.membership.role,
    })),
  };
};

export const updateUserFollows = async (
  ctx: ServiceContext,
  userId: string,
  groupIds: string[],
) => {
  // Remove all existing follows
  await ctx.db.delete(groupFollows).where(eq(groupFollows.userId, userId));

  // Insert new follows
  if (groupIds.length > 0) {
    await ctx.db.insert(groupFollows).values(groupIds.map((groupId) => ({ userId, groupId })));
  }
};

export const updateUserMemberships = async (
  ctx: ServiceContext,
  userId: string,
  memberships: { groupId: string; role: "ADMIN" | "MEMBER" }[],
) => {
  // Remove all existing memberships
  await ctx.db.delete(groupMembers).where(eq(groupMembers.userId, userId));

  // Insert new memberships
  if (memberships.length > 0) {
    await ctx.db
      .insert(groupMembers)
      .values(memberships.map((m) => ({ userId, groupId: m.groupId, role: m.role })));
  }
};

export const deleteAccount = async (ctx: ServiceContext, userId: string, _authId: string) => {
  // Check if user is the sole admin of any groups
  const adminMemberships = await ctx.db
    .select({ groupId: groupMembers.groupId, group: groupPublicColumns })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(and(eq(groupMembers.userId, userId), eq(groupMembers.role, "ADMIN")));

  // For each group where user is admin, check if they're the only admin
  const soleAdminGroups: { id: string; name: string }[] = [];
  for (const membership of adminMemberships) {
    const otherAdmins = await ctx.db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, membership.groupId), eq(groupMembers.role, "ADMIN")));

    if (otherAdmins.length === 1) {
      soleAdminGroups.push({
        id: membership.group.id,
        name: membership.group.name,
      });
    }
  }

  if (soleAdminGroups.length > 0) {
    const error = new Error(
      "You are the sole admin of one or more groups. Please transfer admin role before deleting your account.",
    ) as Error & { adminGroups: { id: string; name: string }[] };
    error.adminGroups = soleAdminGroups;
    throw error;
  }

  // Delete the user (cascades will handle related records)
  const [deleted] = await ctx.db.delete(users).where(eq(users.id, userId)).returning();

  if (!deleted) {
    throw new Error("User not found");
  }

  await eventBus.emit<ProfileDeleted>({
    type: "ProfileDeleted",
    payload: { userId },
  });

  return deleted;
};

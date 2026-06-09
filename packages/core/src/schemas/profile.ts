import { z } from "zod";

export const getProfileSchema = z.object({
  userId: z.uuid("Invalid user ID"),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  gradYear: z.string().optional(),
  majors: z.array(z.string()).max(3).optional(), // Up to 3 majors
  interests: z.array(z.string()).optional(), // Interest categories
});

export const banUserSchema = z.object({
  userId: z.uuid("Invalid user ID"),
  is_banned: z.boolean(),
});

export const updateUserSchema = z.object({
  userId: z.uuid("Invalid user ID"),
  name: z.string().min(1).max(255).optional(),
  gradYear: z.string().optional(),
  majors: z.array(z.string()).max(3).optional(), // Up to 3 majors
});

export const getUsersQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).optional().default(50),
});

export const profileResponseSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  authId: z.string().nullable(),
  name: z.string().nullable(),
  gradYear: z.string().nullable(),
  majors: z.array(z.string()).nullable(), // Array of majors (up to 3)
  interests: z.array(z.string()).nullable(), // Interest categories
  isBanned: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const deleteUserSchema = z.object({
  userId: z.uuid("Invalid user ID"),
});

export const banUserRequestSchema = z.object({
  isBanned: z.boolean(),
});

export const updateUserFollowsSchema = z.object({
  groupIds: z.array(z.uuid("Invalid group ID")),
});

export const updateUserMembershipsSchema = z.object({
  memberships: z.array(
    z.object({
      groupId: z.uuid("Invalid group ID"),
      role: z.enum(["ADMIN", "MEMBER"]),
    }),
  ),
});

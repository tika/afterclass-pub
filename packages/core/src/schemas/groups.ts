import { z } from "zod";
import { eventResponseSchema } from "./events";

export const getGroupsSchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

export const getGroupSchema = z.object({
  id: z.uuid("Invalid group ID"),
});

export const createGroupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  bio: z.string().optional(),
  logoUrl: z.url("Invalid logo URL").optional(),
  bannerUrl: z.url("Invalid banner URL").optional(),
  instagram: z.string().optional(),
  website: z.url("Invalid website URL").optional(),
  categories: z.array(z.string()).optional(),
  isVerified: z.boolean().optional(),
});

export const updateGroupSchema = z.object({
  id: z.uuid("Invalid group ID"),
  name: z.string().min(1).optional(),
  bio: z.string().optional(),
  logoUrl: z.url().optional(),
  bannerUrl: z.url().optional(),
  instagram: z.string().optional(),
  website: z.url().optional(),
  categories: z.array(z.string()).optional(),
  isVerified: z.boolean().optional(),
});

export const deleteGroupSchema = z.object({
  id: z.uuid("Invalid group ID"),
});

export const groupResponseSchema = z.object({
  id: z.uuid(),
  slug: z.string().nullable(),
  createdAt: z.coerce.string(),
  updatedAt: z.coerce.string(),
  name: z.string(),
  bio: z.string().nullable(),
  logoUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  instagram: z.string().nullable(),
  website: z.string().nullable(),
  categories: z.array(z.string()).nullable(),
  isVerified: z.boolean(),
});

export const groupDetailResponseSchema = z.object({
  group: groupResponseSchema,
  upcomingEvents: z.array(
    z.object({
      event: eventResponseSchema,
    }),
  ),
  isFollowing: z.boolean().optional(),
});

// Membership schemas

export const addGroupMemberSchema = z
  .object({
    userId: z.uuid("Invalid user ID").optional(),
    email: z.email("Invalid email address").optional(),
    role: z.enum(["ADMIN", "MEMBER"]),
  })
  .refine((data) => data.userId || data.email, {
    message: "Either userId or email must be provided",
  });

export const removeGroupMemberSchema = z.object({
  userId: z.uuid("Invalid user ID"),
});

export const updateGroupMemberRoleSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]),
});

export const getGroupMembersSchema = z.object({
  id: z.uuid("Invalid group ID"),
});

export const groupMemberResponseSchema = z.object({
  userId: z.uuid(),
  groupId: z.uuid(),
  role: z.enum(["ADMIN", "MEMBER"]),
  createdAt: z.string(),
});

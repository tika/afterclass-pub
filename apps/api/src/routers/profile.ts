import { zValidator } from "@/lib/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppVariables } from "@/lib/types";
import { requireAuth } from "@/middleware/requireAuth";
import { requireAdmin } from "@/middleware/requireAdmin";
import {
  banUserRequestSchema,
  getProfileSchema,
  getUsersQuerySchema,
  updateProfileSchema,
  updateUserFollowsSchema,
  updateUserMembershipsSchema,
  updateUserSchema,
} from "@afterclass/core/schemas/profile";
import * as profileService from "@afterclass/core/services/profile";

// Chain routes to accumulate types for Hono RPC
const profileRouter = new Hono<{ Variables: AppVariables }>()
  .get("/me", requireAuth, async (c) => {
    const ctx = c.get("services");
    const user = c.get("user")!;
    const profile = await profileService.getProfile(ctx, user.id);
    return c.json(profile, 200);
  })
  .get("/:userId", requireAuth, zValidator("param", getProfileSchema), async (c) => {
    const ctx = c.get("services");
    const { userId } = c.req.valid("param");
    const profile = await profileService.getPublicProfile(ctx, userId);
    return c.json(profile, 200);
  })
  .patch("/me", requireAuth, zValidator("json", updateProfileSchema), async (c) => {
    const ctx = c.get("services");
    const user = c.get("user")!;
    const input = c.req.valid("json");
    const profile = await profileService.updateProfile(ctx, user.id, input);
    return c.json({ success: true, profile }, 200);
  })
  .get("/admin/users", requireAdmin, zValidator("query", getUsersQuerySchema), async (c) => {
    const ctx = c.get("services");
    const input = c.req.valid("query");
    const users = await profileService.getUsers(ctx, {
      search: input.search,
      limit: input.limit,
    });
    return c.json({ users }, 200);
  })
  .patch(
    "/admin/users/:userId",
    requireAdmin,
    zValidator("param", getProfileSchema),
    zValidator("json", updateUserSchema.omit({ userId: true })),
    async (c) => {
      const ctx = c.get("services");
      const { userId } = c.req.valid("param");
      const data = c.req.valid("json");
      const profile = await profileService.updateUser(ctx, userId, data);
      return c.json({ success: true, profile }, 200);
    },
  )
  .delete(
    "/admin/users/:userId",
    requireAdmin,
    zValidator("param", getProfileSchema),
    async (c) => {
      const ctx = c.get("services");
      const { userId } = c.req.valid("param");
      await profileService.deleteUser(ctx, userId);
      return c.json({ success: true }, 200);
    },
  )
  .post(
    "/admin/users/:userId/ban",
    requireAdmin,
    zValidator("param", getProfileSchema),
    zValidator("json", banUserRequestSchema),
    async (c) => {
      const ctx = c.get("services");
      const user = c.get("user")!;
      const { userId } = c.req.valid("param");
      const { isBanned } = c.req.valid("json");
      const updatedUser = await profileService.banUser(ctx, userId, isBanned, user.id);
      return c.json({ success: true, user: updatedUser }, 200);
    },
  )
  .get("/admin/users/:userId", requireAdmin, zValidator("param", getProfileSchema), async (c) => {
    const ctx = c.get("services");
    const { userId } = c.req.valid("param");
    const userData = await profileService.getUserWithRelationships(ctx, userId);
    return c.json(userData, 200);
  })
  .patch(
    "/admin/users/:userId/follows",
    requireAdmin,
    zValidator("param", getProfileSchema),
    zValidator("json", updateUserFollowsSchema),
    async (c) => {
      const ctx = c.get("services");
      const { userId } = c.req.valid("param");
      const { groupIds } = c.req.valid("json");
      await profileService.updateUserFollows(ctx, userId, groupIds);
      return c.json({ success: true }, 200);
    },
  )
  .patch(
    "/admin/users/:userId/memberships",
    requireAdmin,
    zValidator("param", getProfileSchema),
    zValidator("json", updateUserMembershipsSchema),
    async (c) => {
      const ctx = c.get("services");
      const { userId } = c.req.valid("param");
      const { memberships } = c.req.valid("json");
      await profileService.updateUserMemberships(ctx, userId, memberships);
      return c.json({ success: true }, 200);
    },
  )
  .delete("/account/delete", requireAuth, async (c) => {
    const ctx = c.get("services");
    const user = c.get("user")!;

    try {
      await profileService.deleteAccount(ctx, user.id, user.id);
      return c.json({ success: true, message: "Account deleted successfully" }, 200);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete account";

      if (errorMessage.includes("admin")) {
        throw new HTTPException(403, { message: errorMessage });
      }

      console.error("Account deletion error:", error);
      throw new HTTPException(500, { message: errorMessage });
    }
  });

export { profileRouter };

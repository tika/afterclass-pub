import { zValidator } from "@/lib/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { isSuperAdmin } from "@afterclass/core/lib/constants";
import type { AppVariables } from "@/lib/types";
import { requireAuth } from "@/middleware/auth";
import { requireAdmin } from "@/middleware/requireAdmin";
import { requireGroupAdmin } from "@/middleware/requireGroupAdmin";
import {
  addGroupMemberSchema,
  createGroupSchema,
  getGroupMembersSchema,
  getGroupSchema,
  getGroupsSchema,
  updateGroupMemberRoleSchema,
  updateGroupSchema,
} from "@afterclass/core/schemas/groups";
import * as eventsService from "@afterclass/core/services/events";
import * as groupsService from "@afterclass/core/services/groups";

// Chain routes to accumulate types for Hono RPC
const groupsRouter = new Hono<{ Variables: AppVariables }>()
  .get("/", requireAuth, zValidator("query", getGroupsSchema), async (c) => {
    const ctx = c.get("services");
    const input = c.req.valid("query");
    const groups = await groupsService.getGroups(ctx, {
      search: input.search,
      limit: input.limit,
      offset: input.offset,
    });
    return c.json(
      {
        groups,
        limit: input.limit,
        offset: input.offset,
      },
      200,
    );
  })
  .get(
    "/interest/:interest",
    requireAuth,
    zValidator("param", z.object({ interest: z.string().min(1) })),
    zValidator(
      "query",
      z.object({
        limit: z.coerce.number().int().positive().max(100).optional().default(50),
        offset: z.coerce.number().int().nonnegative().optional().default(0),
      }),
    ),
    async (c) => {
      const ctx = c.get("services");
      const { interest } = c.req.valid("param");
      const { limit, offset } = c.req.valid("query");
      const groups = await groupsService.getGroupsByInterest(ctx, {
        interest: decodeURIComponent(interest),
        limit,
        offset,
      });
      return c.json({ groups, limit, offset }, 200);
    },
  )
  .get("/interests", requireAuth, async (c) => {
    const ctx = c.get("services");
    const user = c.get("user")!;
    const limit = Number(c.req.query("limit") ?? 50);
    const offset = Number(c.req.query("offset") ?? 0);
    const result = await groupsService.getInterestGroups(ctx, {
      userId: user.id,
      limit,
      offset,
    });
    return c.json({ ...result, limit, offset }, 200);
  })
  .get("/major", requireAuth, async (c) => {
    const ctx = c.get("services");
    const user = c.get("user")!;
    const limit = Number(c.req.query("limit") ?? 50);
    const offset = Number(c.req.query("offset") ?? 0);
    const result = await groupsService.getMajorGroups(ctx, {
      userId: user.id,
      limit,
      offset,
    });
    return c.json({ ...result, limit, offset }, 200);
  })
  .get("/admin/all", requireAdmin, async (c) => {
    const ctx = c.get("services");
    const groups = await groupsService.getAllGroups(ctx);
    return c.json({ groups }, 200);
  })
  .get("/my", requireAuth, async (c) => {
    const ctx = c.get("services");
    const user = c.get("user")!;
    const userGroups = await groupsService.getUserGroups(ctx, user.id);
    return c.json({ groups: userGroups }, 200);
  })
  .get("/my/admins", requireAuth, async (c) => {
    const ctx = c.get("services");
    const user = c.get("user")!;
    const adminGroups = await groupsService.getUserAdminGroups(ctx, user.id);
    return c.json({ groups: adminGroups }, 200);
  })
  .get(
    "/trending",
    requireAuth,
    zValidator(
      "query",
      z.object({
        limit: z.coerce.number().int().positive().max(10).optional().default(5),
      }),
    ),
    async (c) => {
      const ctx = c.get("services");
      const { limit } = c.req.valid("query");
      const trending = await groupsService.getTrendingGroups(ctx, limit);
      return c.json({ groups: trending }, 200);
    },
  )
  .get(
    "/rankings",
    requireAuth,
    zValidator(
      "query",
      z.object({
        limit: z.coerce.number().int().positive().max(10).optional().default(10),
      }),
    ),
    async (c) => {
      const ctx = c.get("services");
      const { limit } = c.req.valid("query");
      const rankings = await groupsService.getCampusRankings(ctx, limit);
      return c.json({ groups: rankings }, 200);
    },
  )
  .get(
    "/by-slug/:slug",
    requireAuth,
    zValidator("param", z.object({ slug: z.string().min(1) })),
    async (c) => {
      const ctx = c.get("services");
      const { slug } = c.req.valid("param");
      const group = await groupsService.getGroupBySlug(ctx, slug, c.get("user")?.id);
      return c.json(group, 200);
    },
  )
  .get("/suggestions", requireAuth, async (c) => {
    const ctx = c.get("services");
    const user = c.get("user")!;
    const limit = Number(c.req.query("limit") ?? 3);
    const result = await groupsService.getSuggestedGroups(ctx, {
      userId: user.id,
      limit: Math.min(limit, 10),
    });
    return c.json(result, 200);
  })
  .get("/:id", requireAuth, zValidator("param", getGroupSchema), async (c) => {
    const ctx = c.get("services");
    const user = c.get("user");
    const { id } = c.req.valid("param");
    const group = await groupsService.getGroup(ctx, id, user?.id);
    return c.json(group, 200);
  })
  .post("/", requireAdmin, zValidator("json", createGroupSchema), async (c) => {
    const ctx = c.get("services");
    console.log("createGroup");
    const user = c.get("user")!;
    const input = c.req.valid("json");
    const group = await groupsService.createGroup(ctx, input, user.id);
    return c.json({ success: true, group }, 201);
  })
  .patch(
    "/:id",
    requireAdmin,
    zValidator("param", getGroupSchema),
    zValidator("json", updateGroupSchema.omit({ id: true })),
    async (c) => {
      const ctx = c.get("services");
      const user = c.get("user")!;
      const { id } = c.req.valid("param");
      const data = c.req.valid("json");
      const group = await groupsService.updateGroup(ctx, id, data, user.id);
      return c.json({ success: true, group }, 200);
    },
  )
  .delete("/:id", requireAdmin, zValidator("param", getGroupSchema), async (c) => {
    const ctx = c.get("services");
    const user = c.get("user")!;
    const { id } = c.req.valid("param");
    await groupsService.deleteGroup(ctx, id, user.id);
    return c.json({ success: true }, 200);
  })
  .get("/:id/members", requireAuth, zValidator("param", getGroupMembersSchema), async (c) => {
    const ctx = c.get("services");
    const { id } = c.req.valid("param");
    const members = await groupsService.getGroupMembers(ctx, id);
    return c.json({ members }, 200);
  })
  .post(
    "/:id/members",
    requireAuth,
    zValidator("param", getGroupMembersSchema),
    zValidator("json", addGroupMemberSchema),
    async (c) => {
      const ctx = c.get("services");
      const user = c.get("user")!;
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");

      const skipAdminCheck = isSuperAdmin(user.email);

      const userIdOrEmail = input.userId || input.email;
      if (!userIdOrEmail) {
        throw new HTTPException(400, { message: "Either userId or email must be provided" });
      }

      const isEmail = !!input.email;

      try {
        const member = await groupsService.addGroupMember(
          ctx,
          id,
          userIdOrEmail,
          input.role,
          user.id,
          skipAdminCheck,
          isEmail,
        );
        return c.json({ success: true, member }, 201);
      } catch (error) {
        if (error instanceof Error && error.message === "INVITATION_SENT") {
          return c.json(
            {
              success: true,
              invitationSent: true,
              message: "Invitation email sent successfully",
            },
            200,
          );
        }
        throw error;
      }
    },
  )
  .delete(
    "/:id/members/:userId",
    requireAuth,
    zValidator("param", getGroupMembersSchema.extend({ userId: z.uuid() })),
    async (c) => {
      const ctx = c.get("services");
      const user = c.get("user")!;
      const { id, userId } = c.req.valid("param");

      const skipAdminCheck = isSuperAdmin(user.email);

      await groupsService.removeGroupMember(ctx, id, userId, user.id, skipAdminCheck);
      return c.json({ success: true }, 200);
    },
  )
  .patch(
    "/:id/members/:userId/role",
    requireAuth,
    zValidator("param", getGroupMembersSchema.extend({ userId: z.uuid() })),
    zValidator("json", updateGroupMemberRoleSchema),
    async (c) => {
      const ctx = c.get("services");
      const user = c.get("user")!;
      const { id, userId } = c.req.valid("param");
      const { role } = c.req.valid("json");
      const member = await groupsService.updateGroupMemberRole(ctx, id, userId, role, user.id);
      return c.json({ success: true, member }, 200);
    },
  )
  .get("/:id/followers", requireAdmin, zValidator("param", getGroupSchema), async (c) => {
    const ctx = c.get("services");
    const { id } = c.req.valid("param");
    const followers = await groupsService.getGroupFollowers(ctx, id);
    return c.json({ followers }, 200);
  })
  .get("/:id/stats", requireGroupAdmin, zValidator("param", getGroupSchema), async (c) => {
    const ctx = c.get("services");
    const { id } = c.req.valid("param");
    const stats = await groupsService.getGroupStats(ctx, id);
    return c.json(stats, 200);
  })
  .get(
    "/:id/events",
    requireGroupAdmin,
    zValidator("param", getGroupSchema),
    zValidator(
      "query",
      z.object({
        status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED", "ARCHIVED"]).optional(),
        upcoming: z.coerce.boolean().optional(),
        limit: z.coerce.number().int().positive().max(100).optional().default(50),
        offset: z.coerce.number().int().nonnegative().optional().default(0),
      }),
    ),
    async (c) => {
      const ctx = c.get("services");
      const { id } = c.req.valid("param");
      const query = c.req.valid("query");
      const events = await eventsService.getGroupEvents(ctx, id, {
        status: query.status,
        upcoming: query.upcoming,
        limit: query.limit,
        offset: query.offset,
      });
      return c.json({ events }, 200);
    },
  )
  .get("/:id/engagement", requireAuth, zValidator("param", getGroupSchema), async (c) => {
    const ctx = c.get("services");
    const { id } = c.req.valid("param");
    const engagement = await groupsService.getGroupEngagementDetails(ctx, id);
    return c.json(engagement, 200);
  })
  .post("/:id/follow", requireAuth, zValidator("param", getGroupSchema), async (c) => {
    const ctx = c.get("services");
    const user = c.get("user")!;
    const { id } = c.req.valid("param");
    const result = await groupsService.followGroup(ctx, id, user.id);
    return c.json(result, 200);
  })
  .delete("/:id/follow", requireAuth, zValidator("param", getGroupSchema), async (c) => {
    const ctx = c.get("services");
    const user = c.get("user")!;
    const { id } = c.req.valid("param");
    const result = await groupsService.unfollowGroup(ctx, id, user.id);
    return c.json(result, 200);
  });

export { groupsRouter };

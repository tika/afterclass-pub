import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppVariables } from "@/lib/types";
import { isGroupAdmin } from "@afterclass/core/services/groups";
import { getBetterAuthSession } from "./auth";

/**
 * Hono middleware to require group admin access.
 * Checks if user is an admin of the specified group.
 * Expects groupId to be in route params.
 */
export const requireGroupAdmin = async (c: Context<{ Variables: AppVariables }>, next: Next) => {
  let user = c.get("user");

  if (!user) {
    const session = await getBetterAuthSession(c);
    if (!session?.user) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    user = {
      id: session.user.id,
      email: session.user.email ?? null,
      name: session.user.name ?? null,
      image: (session.user as { image?: string }).image ?? null,
      createdAt: session.user.createdAt,
    };
    c.set("user", user);
  }

  const groupId = c.req.param("id");
  if (!groupId) {
    throw new HTTPException(400, { message: "Group ID is required" });
  }

  const ctx = c.get("services");
  const isAdmin = await isGroupAdmin(ctx, groupId, user.id);
  if (!isAdmin) {
    throw new HTTPException(403, {
      message: "Forbidden: Only group admins can perform this action",
    });
  }

  await next();
};

import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { events } from "@afterclass/core/db/schema";
import type { AppVariables } from "@/lib/types";
import { isGroupAdmin } from "@afterclass/core/services/groups";
import { getBetterAuthSession } from "./auth";

/**
 * Hono middleware to require group admin access for an event.
 * Checks if user is an admin of the group that owns the event.
 * Expects eventId to be in route params.
 */
export const requireEventGroupAdmin = async (
  c: Context<{ Variables: AppVariables }>,
  next: Next,
) => {
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

  const eventId = c.req.param("id");
  if (!eventId) {
    throw new HTTPException(400, { message: "Event ID is required" });
  }

  const [event] = await c.var.services.db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) {
    throw new HTTPException(404, { message: "Event not found" });
  }

  const ctx = c.get("services");
  const isAdmin = await isGroupAdmin(ctx, event.groupId, user.id);
  if (!isAdmin) {
    throw new HTTPException(403, {
      message: "Forbidden: Only group admins can perform this action",
    });
  }

  await next();
};

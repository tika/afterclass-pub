import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { isSuperAdmin } from "@afterclass/core/lib/constants";
import type { AppVariables } from "@/lib/types";
import { getBetterAuthSession } from "./auth";

/**
 * Hono middleware to require super-admin access.
 * Checks the user's email against the SUPER_ADMIN_EMAILS allowlist.
 */
export const requireAdmin = async (c: Context<{ Variables: AppVariables }>, next: Next) => {
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

  if (!isSuperAdmin(user.email)) {
    throw new HTTPException(403, { message: "Forbidden" });
  }

  await next();
};

import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppVariables } from "@/lib/types";
import { getBetterAuthSession } from "./auth";

/**
 * Middleware to require authenticated user via Better Auth session.
 * Attaches user data to context.
 */
export const requireAuth = async (c: Context<{ Variables: AppVariables }>, next: Next) => {
  const session = await getBetterAuthSession(c);

  if (!session?.user) {
    throw new HTTPException(401, { message: "Unauthorized: Authentication required" });
  }

  if (!session.user.id) {
    throw new HTTPException(401, { message: "Unauthorized: Invalid session" });
  }

  c.set("user", {
    id: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
    image: (session.user as { image?: string }).image ?? null,
    createdAt: session.user.createdAt,
  });

  await next();
};

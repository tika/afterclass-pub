import { and, eq, gt } from "drizzle-orm";
import type { Context } from "hono";
import { createServiceContext } from "@afterclass/core";
import { session as sessionTable, users } from "@afterclass/core/db/schema";
import { getAuth } from "@afterclass/core/lib/auth";

export const getBetterAuthSession = async (c: Context) => {
  const auth = await getAuth();
  let session = await auth.api.getSession({ headers: c.req.raw.headers });

  // Fallback: Better Auth's getSession may not recognize Bearer token (e.g. with bearer plugin).
  // Look up session by token directly for mobile clients.
  if (!session?.user) {
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (token) {
      const ctx = await createServiceContext();
      const [sessionRow] = await ctx.db
        .select()
        .from(sessionTable)
        .where(and(eq(sessionTable.token, token), gt(sessionTable.expiresAt, new Date())))
        .limit(1);

      if (sessionRow && sessionRow.expiresAt > new Date()) {
        const [user] = await ctx.db
          .select()
          .from(users)
          .where(eq(users.id, sessionRow.userId))
          .limit(1);
        if (user) {
          session = {
            user: {
              id: String(user.id),
              email: user.email ?? undefined,
              name: user.name ?? undefined,
              emailVerified: user.emailVerified ?? false,
              createdAt: user.createdAt ?? new Date(),
              updatedAt: user.updatedAt ?? new Date(),
            },
            session: {
              id: sessionRow.id,
              userId: sessionRow.userId,
              token: sessionRow.token,
              expiresAt: sessionRow.expiresAt,
              createdAt: sessionRow.createdAt,
              updatedAt: sessionRow.updatedAt,
            },
          } as typeof session;
        }
      }
    }
  }

  return session;
};

/**
 * Helper to resolve Better Auth user ID (UUID) to database user record.
 * Since Better Auth uses the users table directly, this just fetches by id.
 */
export const getDbUserById = async (userId: string) => {
  const ctx = await createServiceContext();
  const [dbUser] = await ctx.db.select().from(users).where(eq(users.id, userId)).limit(1);
  return dbUser || null;
};

// Re-export requireAuth for backwards compatibility with existing routers
export { requireAuth } from "./requireAuth";

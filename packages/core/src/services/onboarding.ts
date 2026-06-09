import { eq } from "drizzle-orm";
import type { ServiceContext } from "@afterclass/core/services/context";
import { users } from "@afterclass/core/db/schema";

export const validateEmailDomain = async (email: string) => {
  const domain = email.split("@")[1]?.toLowerCase();

  if (!domain) {
    throw new Error("Invalid email format");
  }

  const isValid = domain.length > 0 && domain.includes(".");

  return {
    isValid,
    domain,
    university: null,
  };
};

/** Check onboarding status by Better Auth user UUID */
export const getOnboardingStatusById = async (ctx: ServiceContext, userId: string) => {
  const user = await ctx.db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (user.length === 0 || !user[0]?.name) {
    return {
      needsOnboarding: true,
      profile: user[0] ?? null,
    };
  }

  return {
    needsOnboarding: false,
    profile: user[0],
  };
};

/** Legacy: check onboarding status by authId (Clerk ID) — kept for backwards compat during migration */
export const getOnboardingStatus = async (ctx: ServiceContext, authId: string) => {
  const user = await ctx.db.select().from(users).where(eq(users.authId, authId)).limit(1);

  if (user.length === 0) {
    return {
      needsOnboarding: true,
      profile: null,
    };
  }

  return {
    needsOnboarding: false,
    profile: user[0],
  };
};

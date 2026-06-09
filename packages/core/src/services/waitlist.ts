import { desc } from "drizzle-orm";
import type { ServiceContext } from "./context";
import { waitlistSignups } from "@afterclass/core/db/schema";

export const createWaitlistSignup = async (ctx: ServiceContext, email: string, school: string) => {
  try {
    const [signup] = await ctx.db
      .insert(waitlistSignups)
      .values({
        email: email.toLowerCase().trim(),
        school: school.trim(),
      })
      .returning();

    return signup;
  } catch (error) {
    // Check if it's a unique constraint violation
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      throw new Error("This email is already on the waitlist", { cause: error });
    }
    throw error;
  }
};

export const getAllWaitlistSignups = async (ctx: ServiceContext) => {
  return await ctx.db.select().from(waitlistSignups).orderBy(desc(waitlistSignups.createdAt));
};

import { zValidator } from "@/lib/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppVariables } from "@/lib/types";
import {
  completeOnboardingSchema,
  validateEmailDomainSchema,
} from "@afterclass/core/schemas/onboarding";
import * as onboardingService from "@afterclass/core/services/onboarding";
import * as profileService from "@afterclass/core/services/profile";
import { getBetterAuthSession } from "@/middleware/auth";

// Chain routes to accumulate types for Hono RPC
const onboardingRouter = new Hono<{ Variables: AppVariables }>()
  .post("/validate-email-domain", zValidator("json", validateEmailDomainSchema), async (c) => {
    const { email } = c.req.valid("json");
    try {
      const result = await onboardingService.validateEmailDomain(email);
      return c.json(result, 200);
    } catch (error) {
      console.error("[Error] validateEmailDomain failed:", error);
      throw error;
    }
  })
  .get("/status", async (c) => {
    const session = await getBetterAuthSession(c);

    if (!session?.user) {
      throw new HTTPException(401, { message: "Unauthorized: Authentication required" });
    }

    const ctx = c.get("services");
    // Check by user ID directly (Better Auth user ID = DB UUID)
    const status = await onboardingService.getOnboardingStatusById(ctx, session.user.id);
    return c.json(status, 200);
  })
  .post("/complete", zValidator("json", completeOnboardingSchema), async (c) => {
    const session = await getBetterAuthSession(c);

    if (!session?.user) {
      throw new HTTPException(401, { message: "Unauthorized: Authentication required" });
    }

    const ctx = c.get("services");
    const input = c.req.valid("json");

    // Better Auth already created the user row on sign-in. We just update the profile fields.
    try {
      const profile = await profileService.completeOnboarding(ctx, session.user.id, {
        name: input.name,
        gradYear: input.class_of.toString(),
        majors: input.majors,
        interests: input.interests,
      });
      return c.json({ success: true, profile }, 201);
    } catch (error) {
      if (error instanceof Error && error.message === "Profile not found") {
        throw new HTTPException(404, { message: "User profile not found" });
      }
      console.error("Onboarding completion error:", error);
      throw new HTTPException(500, { message: "Failed to complete onboarding" });
    }
  })
  .post("/reset", async (c) => {
    const session = await getBetterAuthSession(c);

    if (!session?.user) {
      throw new HTTPException(401, { message: "Unauthorized: Authentication required" });
    }

    const ctx = c.get("services");
    try {
      await profileService.resetOnboarding(ctx, session.user.id);
      return c.json({ success: true }, 200);
    } catch (error) {
      console.error("Onboarding reset error:", error);
      throw new HTTPException(500, { message: "Failed to reset onboarding" });
    }
  });

export { onboardingRouter };

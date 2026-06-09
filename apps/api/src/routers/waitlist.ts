import { zValidator } from "@/lib/zod-validator";
import { Hono } from "hono";
import { getSignedCookie, setSignedCookie } from "hono/cookie";
import { createWaitlistSignupSchema } from "@afterclass/core/schemas/waitlist";
import { HTTPException } from "hono/http-exception";
import { sendWaitlistConfirmationEmail } from "@afterclass/core/lib/email";
import { getSecrets } from "@afterclass/core/lib/secrets";
import type { AppVariables } from "@/lib/types";
import { requireAdmin } from "@/middleware/requireAdmin";
import * as waitlistService from "@afterclass/core/services/waitlist";

// Chain routes to accumulate types for Hono RPC
const waitlistRouter = new Hono<{ Variables: AppVariables }>()
  .post("/signup", zValidator("json", createWaitlistSignupSchema), async (c) => {
    const { email, school } = c.req.valid("json");
    const { cookieSecret } = await getSecrets();
    const ctx = c.get("services");

    try {
      const signup = await waitlistService.createWaitlistSignup(ctx, email, school);

      if (!signup) {
        throw new HTTPException(500, {
          message: "Failed to create waitlist signup",
        });
      }

      await setSignedCookie(c, "waitlist_signed", "true", cookieSecret, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax",
        maxAge: 90 * 24 * 60 * 60,
      });

      try {
        await sendWaitlistConfirmationEmail({
          email: signup.email,
          school: signup.school,
        });
      } catch (emailError) {
        console.error("Failed to send waitlist confirmation email:", emailError);
      }

      return c.json(
        {
          success: true,
          signup: {
            id: signup.id,
            email: signup.email,
            school: signup.school,
            createdAt: signup.createdAt.toISOString(),
          },
        },
        201,
      );
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      if (error instanceof Error) {
        if (error.message === "This email is already on the waitlist") {
          await setSignedCookie(c, "waitlist_signed", "true", cookieSecret, {
            path: "/",
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "Lax",
            maxAge: 90 * 24 * 60 * 60,
          });
          throw new HTTPException(409, {
            message: "Something went wrong",
          });
        }
        throw new HTTPException(400, {
          message: "Something went wrong",
        });
      }
      throw new HTTPException(500, {
        message: "Failed to create waitlist signup",
      });
    }
  })
  .get("/check", async (c) => {
    try {
      const { cookieSecret } = await getSecrets();
      const cookieValue = await getSignedCookie(c, "waitlist_signed", cookieSecret);
      return c.json({ hasSignedUp: cookieValue === "true" }, 200);
    } catch (_error) {
      return c.json({ hasSignedUp: false }, 200);
    }
  })
  .get("/admin/all", requireAdmin, async (c) => {
    try {
      const ctx = c.get("services");
      const signups = await waitlistService.getAllWaitlistSignups(ctx);

      return c.json(
        {
          signups: signups.map((signup) => ({
            id: signup.id,
            email: signup.email,
            school: signup.school,
            createdAt: signup.createdAt,
          })),
        },
        200,
      );
    } catch (error) {
      console.error("Failed to fetch waitlist signups:", error);
      throw new HTTPException(500, {
        message: "Failed to fetch waitlist signups",
      });
    }
  });

export { waitlistRouter };

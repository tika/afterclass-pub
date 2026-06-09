import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { users, session as sessionTable } from "@afterclass/core/db/schema";
import { getAuth } from "@afterclass/core/lib/auth";
import {
  sendPhoneOTP,
  verifyPhoneOTP,
  getVerifiedPhone,
  linkPhoneToUser,
} from "@afterclass/core/lib/phone-auth";
import type { AppVariables } from "@/lib/types";

const phoneAuthRouter = new Hono<{ Variables: AppVariables }>();

// Schema for phone number input
const phoneSchema = z.object({
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, "Invalid phone number format"),
});

// Schema for OTP verification
const verifySchema = z.object({
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, "Invalid phone number format"),
  code: z.string().length(6, "Code must be 6 digits"),
});

// Schema for email linking (after phone verified but no user found)
const linkEmailSchema = z.object({
  verificationId: z.string().uuid(),
  email: z.string().email(),
});

// Schema for completing sign-in after email OTP verified
const completeSchema = z.object({
  verificationId: z.string().uuid(),
  email: z.string().email(),
  code: z.string().length(6, "Code must be 6 digits"),
});

/**
 * Create a session for a user and return session token
 */
async function createSessionForUser(
  db: AppVariables["services"]["db"],
  userId: string,
  req: Request,
): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const userAgent = req.headers.get("user-agent") || undefined;
  // Get IP from common headers
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    undefined;

  await db.insert(sessionTable).values({
    id: sessionId,
    userId,
    token,
    expiresAt,
    userAgent,
    ipAddress,
  });

  return { token, expiresAt };
}

/**
 * Build session cookie string
 */
function buildSessionCookie(token: string, expiresAt: Date): string {
  const maxAge = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  return `better-auth.session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

/**
 * POST /phone/send-otp
 * Send OTP to phone number
 */
phoneAuthRouter.post("/send-otp", zValidator("json", phoneSchema), async (c) => {
  const { phoneNumber } = c.req.valid("json");

  try {
    await sendPhoneOTP(phoneNumber);
    return c.json({ success: true });
  } catch (error) {
    console.error("[PhoneAuth] Failed to send OTP:", error);
    const message = error instanceof Error ? error.message : "Failed to send OTP";
    return c.json({ error: message }, 400);
  }
});

/**
 * POST /phone/verify
 * Verify phone OTP
 * Returns:
 * - { status: "signed_in", user, session } if user exists with this phone
 * - { status: "needs_email", verificationId, phoneNumber } if phone verified but no user
 */
phoneAuthRouter.post("/verify", zValidator("json", verifySchema), async (c) => {
  const { phoneNumber, code } = c.req.valid("json");

  try {
    const result = await verifyPhoneOTP(phoneNumber, code);

    if (result.status === "user_found") {
      // User exists with this phone - sign them in
      const [user] = await c.var.services.db
        .select()
        .from(users)
        .where(eq(users.id, result.userId))
        .limit(1);

      if (!user) {
        return c.json({ error: "User not found" }, 404);
      }

      // Create session
      const session = await createSessionForUser(c.var.services.db, user.id, c.req.raw);

      // Return response with session cookie
      return new Response(
        JSON.stringify({
          status: "signed_in",
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            phoneNumber: user.phoneNumber,
            phoneNumberVerified: user.phoneNumberVerified,
          },
          session: {
            token: session.token,
            expiresAt: session.expiresAt.toISOString(),
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": buildSessionCookie(session.token, session.expiresAt),
          },
        },
      );
    }

    // Phone verified but no user - need email linking
    return c.json({
      status: "needs_email",
      verificationId: result.verificationId,
      phoneNumber: result.phoneNumber,
    });
  } catch (error) {
    console.error("[PhoneAuth] Verification failed:", error);
    const message = error instanceof Error ? error.message : "Verification failed";
    return c.json({ error: message }, 400);
  }
});

/**
 * POST /phone/send-email-otp
 * After phone is verified but no user found, send email OTP
 */
phoneAuthRouter.post("/send-email-otp", zValidator("json", linkEmailSchema), async (c) => {
  const { verificationId, email } = c.req.valid("json");

  // Validate the verification ID has a verified phone
  const phoneNumber = await getVerifiedPhone(verificationId);
  if (!phoneNumber) {
    return c.json({ error: "Invalid or expired verification" }, 400);
  }

  // Validate email domain (must be .edu or tufts.edu)
  const emailLower = email.toLowerCase();
  if (!emailLower.endsWith(".edu") && !emailLower.includes("tufts.edu")) {
    return c.json({ error: "Please use your .edu email address" }, 400);
  }

  try {
    // Use better-auth's email OTP to send verification
    const auth = await getAuth();
    await auth.api.sendVerificationOTP({
      body: {
        email,
        type: "sign-in",
      },
    });

    return c.json({ success: true });
  } catch (error) {
    console.error("[PhoneAuth] Failed to send email OTP:", error);
    return c.json({ error: "Failed to send email verification" }, 400);
  }
});

/**
 * POST /phone/complete
 * Complete sign-in: verify email OTP and link phone to user
 */
phoneAuthRouter.post("/complete", zValidator("json", completeSchema), async (c) => {
  const { verificationId, email, code } = c.req.valid("json");

  // Get the verified phone number
  const phoneNumber = await getVerifiedPhone(verificationId);
  if (!phoneNumber) {
    return c.json({ error: "Invalid or expired verification" }, 400);
  }

  try {
    const auth = await getAuth();

    // Use better-auth's signInEmailOTP to verify and sign in/register
    // This handles both existing users and new users
    const response = await auth.api.signInEmailOTP({
      body: {
        email,
        otp: code,
      },
      asResponse: true,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = "Email verification failed";
      try {
        const errorData = JSON.parse(errorText) as { message?: string };
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // Use default error message
      }
      return c.json({ error: errorMessage }, 400);
    }

    // Get the response data - better-auth may return { user, token } or { user, session }
    const data = (await response.json()) as {
      user: { id: string; email: string; name: string | null };
      session?: { token: string; expiresAt: string };
      token?: string;
    };

    const token = data.session?.token ?? data.token;
    if (!token || !data.user) {
      console.error("[PhoneAuth] Invalid better-auth response:", Object.keys(data));
      return c.json({ error: "Invalid auth response" }, 500);
    }

    // Link the phone number to the user
    await linkPhoneToUser(data.user.id, phoneNumber);

    // Return the response with cookies from better-auth
    const setCookieHeader = response.headers.get("Set-Cookie");
    const expiresAt =
      data.session?.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    return new Response(
      JSON.stringify({
        status: "signed_in",
        user: {
          ...data.user,
          phoneNumber,
          phoneNumberVerified: true,
        },
        session: { token, expiresAt },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...(setCookieHeader ? { "Set-Cookie": setCookieHeader } : {}),
        },
      },
    );
  } catch (error) {
    console.error("[PhoneAuth] Complete sign-in failed:", error);
    const message = error instanceof Error ? error.message : "Sign-in failed";
    return c.json({ error: message }, 400);
  }
});

export { phoneAuthRouter };

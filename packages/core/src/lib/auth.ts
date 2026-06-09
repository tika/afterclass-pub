import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, emailOTP, phoneNumber } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { Resend } from "resend";
import Twilio from "twilio";
import * as schema from "@afterclass/core/db/schema";
import { getSecrets } from "@afterclass/core/lib/secrets";

const createAuth = async () => {
  const secrets = await getSecrets();
  const db = drizzle(postgres(secrets.databaseRuntimeUrl), { schema });
  const resend = new Resend(secrets.resendApiKey);

  // Twilio client for phone verification via Verify service
  const hasTwilioCredentials = !!(secrets.twilioAccountSid && secrets.twilioAuthToken);
  const twilioClient = hasTwilioCredentials
    ? Twilio(secrets.twilioAccountSid, secrets.twilioAuthToken)
    : null;
  const twilioVerifyServiceSid = secrets.twilioVerifyServiceSid;

  console.log("[Auth] Twilio configured:", {
    hasAccountSid: !!secrets.twilioAccountSid,
    hasAuthToken: !!secrets.twilioAuthToken,
    hasVerifyServiceSid: !!twilioVerifyServiceSid,
    twilioClientCreated: !!twilioClient,
  });

  return betterAuth({
    secret: secrets.betterAuthSecret,
    baseURL: secrets.betterAuthUrl,
    trustedOrigins: [
      "http://localhost:3000",
      "http://localhost:8081",
      "https://afterclass.rsvp",
      "https://www.afterclass.rsvp",
      "https://app.afterclass.rsvp",
      "https://admin.afterclass.rsvp",
      "https://*.ngrok.io",
      "https://*.ngrok-free.app",
      ...(secrets.betterAuthUrl ? [secrets.betterAuthUrl] : []),
      ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS
        ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((o) => o.trim())
        : []),
    ],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        ...schema,
        user: schema.users,
      },
    }),
    emailAndPassword: {
      enabled: false,
    },
    plugins: [
      bearer(), // Required for iOS/mobile: getSession accepts Authorization: Bearer <token>
      emailOTP({
        async sendVerificationOTP({ email, otp, type }) {
          const subject =
            type === "sign-in"
              ? "Your Afterclass sign-in code"
              : type === "email-verification"
                ? "Verify your email address"
                : "Reset your password";

          try {
            const result = await resend.emails.send({
              from: secrets.resendFromEmail || "Afterclass <onboarding@resend.dev>",
              to: [email],
              subject,
              html: `<p>Your verification code is: <strong>${otp}</strong></p><p>This code expires in 5 minutes.</p>`,
            });

            if (result.error) {
              console.error(`Failed to send OTP email to ${email}:`, result.error);
            } else {
              console.log(`OTP email sent to ${email} (${type})`);
            }
          } catch (error) {
            console.error(`Error sending OTP email to ${email}:`, error);
          }
        },
      }),
      // Phone number auth for iOS (primary sign-in method via Twilio Verify)
      phoneNumber({
        async sendOTP({ phoneNumber: phone }) {
          if (!twilioClient || !twilioVerifyServiceSid) {
            console.error("Twilio Verify not configured");
            throw new Error("Phone verification not available");
          }
          try {
            await twilioClient.verify.v2
              .services(twilioVerifyServiceSid)
              .verifications.create({ to: phone, channel: "sms" });
            console.log(`Twilio Verify OTP sent to ${phone}`);
          } catch (error) {
            console.error(`Failed to send Verify OTP to ${phone}:`, error);
            throw error;
          }
        },
        async verifyOTP({ phoneNumber: phone, code }) {
          if (!twilioClient || !twilioVerifyServiceSid) {
            return false;
          }
          try {
            const check = await twilioClient.verify.v2
              .services(twilioVerifyServiceSid)
              .verificationChecks.create({ to: phone, code });
            return check.status === "approved";
          } catch (error) {
            console.error(`Failed to verify OTP for ${phone}:`, error);
            return false;
          }
        },
        phoneNumberValidator: (phone) => {
          return /^\+[1-9]\d{1,14}$/.test(phone);
        },
      }),
    ],
    user: {
      modelName: "users",
      fields: {
        emailVerified: "email_verified",
        phoneNumber: "phone_number",
        phoneNumberVerified: "phone_number_verified",
      },
      additionalFields: {
        gradYear: {
          type: "string",
          required: false,
        },
        majors: {
          type: "string[]",
          required: false,
        },
        authId: {
          type: "string",
          required: false,
          input: false,
        },
        isBanned: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // update every 24 hours
    },
    advanced: {
      database: {
        // Let the users table UUID default handle user IDs, generate text IDs for auth tables
        generateId: (options) => {
          if (options.model === "user" || options.model === "users") {
            return false; // Let PostgreSQL uuid_generate_v4() / gen_random_uuid() handle it
          }
          return crypto.randomUUID();
        },
      },
      // Cookies are set via same-origin proxy (Next.js rewrites /api/auth/* to the API),
      // so standard lax cookies work everywhere. Secure is auto-detected from baseURL.
      defaultCookieAttributes: {
        sameSite: "lax" as const,
      },
    },
  });
};

// Singleton promise
let authInstance: Awaited<ReturnType<typeof createAuth>> | null = null;

export const getAuth = async () => {
  if (!authInstance) {
    authInstance = await createAuth();
  }
  return authInstance;
};

export type Auth = Awaited<ReturnType<typeof createAuth>>;

import { eq } from "drizzle-orm";
import Twilio from "twilio";
import { createServiceContext } from "@afterclass/core/db";
import { users, verification } from "@afterclass/core/db/schema";
import { getSecrets } from "@afterclass/core/lib/secrets";

// Phone verification flow:
// 1. Send OTP via Twilio Verify
// 2. Verify OTP
// 3. If user with phone exists -> return user for sign-in
// 4. If no user -> store verified phone, require email linking

type PhoneVerifyResult =
  | { status: "user_found"; userId: string; phoneNumber: string }
  | { status: "needs_email"; verificationId: string; phoneNumber: string };

let twilioClient: ReturnType<typeof Twilio> | null = null;
let verifyServiceSid: string | null = null;

async function getTwilioClient() {
  if (twilioClient && verifyServiceSid) {
    return { client: twilioClient, serviceSid: verifyServiceSid };
  }

  const secrets = await getSecrets();
  if (!secrets.twilioAccountSid || !secrets.twilioAuthToken || !secrets.twilioVerifyServiceSid) {
    throw new Error("Twilio credentials not configured");
  }

  twilioClient = Twilio(secrets.twilioAccountSid, secrets.twilioAuthToken);
  verifyServiceSid = secrets.twilioVerifyServiceSid;

  return { client: twilioClient, serviceSid: verifyServiceSid };
}

/**
 * Send OTP to phone number via Twilio Verify
 */
export async function sendPhoneOTP(phoneNumber: string): Promise<void> {
  // Validate phone number format (E.164)
  if (!/^\+[1-9]\d{1,14}$/.test(phoneNumber)) {
    throw new Error("Invalid phone number format. Use E.164 format (e.g., +1234567890)");
  }

  const { client, serviceSid } = await getTwilioClient();

  await client.verify.v2.services(serviceSid).verifications.create({
    to: phoneNumber,
    channel: "sms",
  });

  console.log(`[PhoneAuth] OTP sent to ${phoneNumber}`);
}

/**
 * Verify phone OTP and check if user exists
 * Returns user info if found, or verification ID if email linking is needed
 */
export async function verifyPhoneOTP(
  phoneNumber: string,
  code: string,
): Promise<PhoneVerifyResult> {
  const { client, serviceSid } = await getTwilioClient();

  // Verify the code with Twilio
  const check = await client.verify.v2.services(serviceSid).verificationChecks.create({
    to: phoneNumber,
    code,
  });

  if (check.status !== "approved") {
    throw new Error("Invalid verification code");
  }

  console.log(`[PhoneAuth] OTP verified for ${phoneNumber}`);

  // Check if user with this phone exists
  const ctx = await createServiceContext();
  const [existingUser] = await ctx.db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.phoneNumber, phoneNumber))
    .limit(1);

  if (existingUser) {
    return {
      status: "user_found",
      userId: existingUser.id,
      phoneNumber,
    };
  }

  // No user found - store verified phone for email linking
  // Use the verification table to store the verified phone temporarily
  const verificationId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await ctx.db.insert(verification).values({
    id: verificationId,
    identifier: `phone:${phoneNumber}`,
    value: phoneNumber,
    expiresAt,
  });

  console.log(`[PhoneAuth] Phone verified, needs email linking: ${phoneNumber}`);

  return {
    status: "needs_email",
    verificationId,
    phoneNumber,
  };
}

/**
 * Get verified phone number from verification ID
 * Used after email verification to link phone to user
 */
export async function getVerifiedPhone(verificationId: string): Promise<string | null> {
  const ctx = await createServiceContext();

  const [record] = await ctx.db
    .select()
    .from(verification)
    .where(eq(verification.id, verificationId))
    .limit(1);

  if (!record) {
    return null;
  }

  // Check if expired
  if (record.expiresAt < new Date()) {
    // Clean up expired record
    await ctx.db.delete(verification).where(eq(verification.id, verificationId));
    return null;
  }

  // Must be a phone verification
  if (!record.identifier.startsWith("phone:")) {
    return null;
  }

  return record.value;
}

/**
 * Link phone number to user after email verification
 */
export async function linkPhoneToUser(userId: string, phoneNumber: string): Promise<void> {
  const ctx = await createServiceContext();

  await ctx.db
    .update(users)
    .set({
      phoneNumber,
      phoneNumberVerified: true,
    })
    .where(eq(users.id, userId));

  // Clean up the verification record
  await ctx.db.delete(verification).where(eq(verification.identifier, `phone:${phoneNumber}`));

  console.log(`[PhoneAuth] Phone ${phoneNumber} linked to user ${userId}`);
}

/**
 * Find user by phone number
 */
export async function findUserByPhone(phoneNumber: string) {
  const ctx = await createServiceContext();

  const [user] = await ctx.db
    .select()
    .from(users)
    .where(eq(users.phoneNumber, phoneNumber))
    .limit(1);

  return user || null;
}

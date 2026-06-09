import type { Secrets } from "@afterclass/config";

let secrets: Secrets | null = null;

// Map environment variable names to secret keys
// Secrets are injected as Lambda env vars at deploy time (no runtime SSM/KMS calls)
const ENV_VAR_MAP: Record<keyof Secrets, string> = {
  databaseRuntimeUrl: "DATABASE_RUNTIME_URL",
  clerkSecretKey: "CLERK_SECRET_KEY",
  clerkPublicKey: "CLERK_PUBLISHABLE_KEY",
  resendApiKey: "RESEND_API_KEY",
  resendFromEmail: "RESEND_FROM_EMAIL",
  afterclassApiKey: "AFTERCLASS_API_KEY",
  cookieSecret: "COOKIE_SECRET",
  apnsKeyId: "APNS_KEY_ID",
  apnsTeamId: "APNS_TEAM_ID",
  apnsBundleId: "APNS_BUNDLE_ID",
  apnsKeyP8: "APNS_KEY_P8",
  googleGenaiApiKey: "GOOGLE_GENAI_API_KEY",
  cerebrasApiKey: "CEREBRAS_API_KEY",
  openaiApiKey: "OPENAI_API_KEY",
  upstashRedisUrl: "UPSTASH_REDIS_URL",
  upstashRedisToken: "UPSTASH_REDIS_TOKEN",
  betterAuthSecret: "BETTER_AUTH_SECRET",
  betterAuthUrl: "BETTER_AUTH_URL",
  twilioAccountSid: "TWILIO_ACCOUNT_SID",
  twilioAuthToken: "TWILIO_AUTH_TOKEN",
  twilioVerifyServiceSid: "TWILIO_VERIFY_SERVICE_SID",
  posthogApiKey: "POSTHOG_API_KEY",
};

export async function getSecrets(): Promise<Secrets> {
  if (secrets) return secrets;

  // Read secrets from environment variables
  // In production: injected by Pulumi at deploy time
  // In development: loaded from .env file
  secrets = {} as Secrets;
  for (const [key, envVar] of Object.entries(ENV_VAR_MAP)) {
    secrets[key as keyof Secrets] = process.env[envVar] ?? "";
  }
  return secrets;
}

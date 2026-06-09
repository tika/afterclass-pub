// map secret names to their SSM parameter names
export const SECRET_KEYS = {
  databaseRuntimeUrl: "database-runtime-url",
  clerkSecretKey: "clerk-secret-key",
  clerkPublicKey: "clerk-public-key",
  resendApiKey: "resend-api-key",
  resendFromEmail: "resend-from-email",
  afterclassApiKey: "afterclass-api-key",
  cookieSecret: "cookie-secret",
  apnsKeyId: "apns-key-id",
  apnsTeamId: "apns-team-id",
  apnsBundleId: "apns-bundle-id",
  apnsKeyP8: "apns-key-p8",
  googleGenaiApiKey: "google-genai-api-key",
  cerebrasApiKey: "cerebras-api-key",
  openaiApiKey: "openai-api-key",
  upstashRedisUrl: "upstash-redis-url",
  upstashRedisToken: "upstash-redis-token",
  betterAuthSecret: "better-auth-secret",
  betterAuthUrl: "better-auth-url",
  twilioAccountSid: "twilio-account-sid",
  twilioAuthToken: "twilio-auth-token",
  twilioVerifyServiceSid: "twilio-verify-service-sid",
  posthogApiKey: "posthog-api-key",
} as const;

export type SecretKey = keyof typeof SECRET_KEYS;
export type Secrets = Record<SecretKey, string>;

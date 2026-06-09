import { SECRET_KEYS } from "@afterclass/config";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const cfg = new pulumi.Config("afterclass");
const stack = pulumi.getStack();

// database-runtime-url and database-owner-url are provisioned by database.ts (not here)
const DB_SSM_NAMES = ["database-runtime-url", "database-owner-url"];

// SSM Parameters (kept for backup/audit, but not used at runtime)
export const ssmParameters = Object.fromEntries(
  Object.entries(SECRET_KEYS)
    .filter(([, ssmName]) => !DB_SSM_NAMES.includes(ssmName))
    .map(([key, ssmName]) => [
      key,
      new aws.ssm.Parameter(key, {
        name: `/afterclass/${stack}/${ssmName}`,
        type: aws.ssm.ParameterType.SecureString,
        value: cfg.requireSecret(ssmName),
      }),
    ]),
) as Partial<Record<keyof typeof SECRET_KEYS, aws.ssm.Parameter>>;

// Export secret values directly for Lambda environment variables
// This eliminates runtime SSM/KMS calls - secrets are injected at deploy time
export const secretValues = {
  DATABASE_RUNTIME_URL: cfg.requireSecret("database-runtime-url"),
  CLERK_SECRET_KEY: cfg.requireSecret("clerk-secret-key"),
  CLERK_PUBLISHABLE_KEY: cfg.requireSecret("clerk-public-key"),
  RESEND_API_KEY: cfg.requireSecret("resend-api-key"),
  AFTERCLASS_API_KEY: cfg.requireSecret("afterclass-api-key"),
  COOKIE_SECRET: cfg.requireSecret("cookie-secret"),
  APNS_KEY_ID: cfg.requireSecret("apns-key-id"),
  APNS_TEAM_ID: cfg.requireSecret("apns-team-id"),
  APNS_BUNDLE_ID: cfg.requireSecret("apns-bundle-id"),
  APNS_KEY_P8: cfg.requireSecret("apns-key-p8"),
  GOOGLE_GENAI_API_KEY: cfg.requireSecret("google-genai-api-key"),
  CEREBRAS_API_KEY: cfg.requireSecret("cerebras-api-key"),
  OPENAI_API_KEY: cfg.requireSecret("openai-api-key"),
  UPSTASH_REDIS_URL: cfg.requireSecret("upstash-redis-url"),
  UPSTASH_REDIS_TOKEN: cfg.requireSecret("upstash-redis-token"),
  POSTHOG_API_KEY: cfg.requireSecret("posthog-api-key"),
  RESEND_FROM_EMAIL: cfg.requireSecret("resend-from-email"),
  BETTER_AUTH_SECRET: cfg.requireSecret("better-auth-secret"),
  BETTER_AUTH_URL: cfg.requireSecret("better-auth-url"),
  TWILIO_ACCOUNT_SID: cfg.requireSecret("twilio-account-sid"),
  TWILIO_AUTH_TOKEN: cfg.requireSecret("twilio-auth-token"),
  TWILIO_VERIFY_SERVICE_SID: cfg.requireSecret("twilio-verify-service-sid"),
};

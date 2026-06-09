/**
 * Verify existing users are ready for Better Auth (email OTP).
 *
 * No data migration is needed — existing users sign in with their email OTP
 * and Better Auth matches by email to the existing row.
 *
 * This script:
 * 1. Reports counts and any invalid rows
 * 2. Sets email_verified = true on all existing users (they were verified via Clerk)
 *
 * Run: pnpm --filter @afterclass/scripts tsx src/verifyUsersForBetterAuth.ts
 */

import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@afterclass/core/db/schema";

config({ path: ".env.local" });

async function main() {
  const url = process.env.DATABASE_RUNTIME_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_RUNTIME_URL or DATABASE_URL is required in .env.local");

  const client = postgres(url);
  const db = drizzle(client, { schema });
  const { users } = schema;

  const allUsers = await db.select().from(users);
  console.log(`Total users: ${allUsers.length}`);

  const noEmail = allUsers.filter((u) => !u.email || !u.email.includes("@"));
  if (noEmail.length > 0) {
    console.warn(`⚠️  ${noEmail.length} users with invalid/missing email:`);
    noEmail.forEach((u) => console.warn(`   id=${u.id} email=${u.email}`));
  } else {
    console.log("✓ All users have valid emails");
  }

  const noName = allUsers.filter((u) => !u.name);
  console.log(`  ${noName.length} users with no name (incomplete onboarding)`);

  // Mark all existing users as email_verified since they authenticated via Clerk
  const result = await db
    .update(users)
    .set({ emailVerified: true })
    .where(sql`${users.emailVerified} = false`)
    .returning({ id: users.id });

  console.log(`✓ Marked ${result.length} existing users as email_verified`);
  console.log("\nDone. Existing users will sign in seamlessly via email OTP.");

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});

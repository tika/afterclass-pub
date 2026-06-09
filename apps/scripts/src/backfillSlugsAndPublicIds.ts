/**
 * Backfill slugs for existing groups and public_ids for existing events.
 * Run after applying migration 0022.
 *
 * Usage: pnpm run backfill:slugs
 */

import { config } from "dotenv";
import { eq, isNull } from "drizzle-orm";
import { events, groups } from "@afterclass/core/db/schema";
import { createServiceContext } from "@afterclass/core";
import { generatePublicId, slugify } from "@afterclass/core/lib/slug";

config({ path: ".env.local" });

async function backfillGroupSlugs() {
  const { db } = await createServiceContext();

  const toProcess = await db.select().from(groups).where(isNull(groups.slug));

  console.log(`Found ${toProcess.length} groups without slugs`);

  let updated = 0;
  for (const group of toProcess) {
    const baseSlug = slugify(group.name);
    let slug = baseSlug;
    let counter = 2;

    // Ensure uniqueness
    while (true) {
      const existing = await db
        .select({ id: groups.id })
        .from(groups)
        .where(eq(groups.slug, slug))
        .limit(1);
      if (existing.length === 0) break;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    await db.update(groups).set({ slug }).where(eq(groups.id, group.id));
    updated++;
    console.log(`  [${updated}/${toProcess.length}] ${group.name} → ${slug}`);
  }

  console.log(`✓ Backfilled ${updated} group slugs`);
}

async function backfillEventPublicIds() {
  const { db } = await createServiceContext();

  const toProcess = await db.select().from(events).where(isNull(events.publicId));

  console.log(`Found ${toProcess.length} events without public IDs`);

  let updated = 0;
  for (const event of toProcess) {
    let publicId: string;
    while (true) {
      publicId = generatePublicId(8);
      const existing = await db
        .select({ id: events.id })
        .from(events)
        .where(eq(events.publicId, publicId))
        .limit(1);
      if (existing.length === 0) break;
    }

    await db.update(events).set({ publicId }).where(eq(events.id, event.id));
    updated++;
    if (updated % 50 === 0) {
      console.log(`  [${updated}/${toProcess.length}] ...`);
    }
  }

  console.log(`✓ Backfilled ${updated} event public IDs`);
}

async function main() {
  console.log("=== Backfill Slugs & Public IDs ===\n");

  await backfillGroupSlugs();
  console.log();
  await backfillEventPublicIds();

  console.log("\n=== Done ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});

/**
 * Backfill embeddings for existing groups and events.
 * Run after applying migrations 0020 and 0021.
 * Requires OPENAI_API_KEY in environment.
 *
 * Usage: pnpm run backfill:embeddings
 */

import { config } from "dotenv";
import { eq, isNull } from "drizzle-orm";
import { events, groups } from "@afterclass/core/db/schema";
import { createServiceContext } from "@afterclass/core";
import {
  generateEventEmbedding,
  generateGroupEmbedding,
} from "@afterclass/core/services/embeddings";

config({ path: ".env.local" });

const BATCH_SIZE = 10;
const DELAY_MS = 200; // Avoid OpenAI rate limits

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function backfillGroupEmbeddings() {
  const { db } = await createServiceContext();

  const toProcess = await db.select().from(groups).where(isNull(groups.embedding));

  console.log(`Found ${toProcess.length} groups without embeddings`);

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (group) => {
        try {
          const embedding = await generateGroupEmbedding(group);
          await db.update(groups).set({ embedding }).where(eq(groups.id, group.id));
          processed++;
          console.log(`  [${processed}/${toProcess.length}] Group: ${group.name}`);
        } catch (err) {
          failed++;
          console.error(`  Failed group ${group.id} (${group.name}):`, err);
        }
      }),
    );
    if (i + BATCH_SIZE < toProcess.length) {
      await sleep(DELAY_MS);
    }
  }

  return { processed, failed };
}

async function backfillEventEmbeddings() {
  const { db } = await createServiceContext();

  const toProcess = await db.select().from(events).where(isNull(events.embedding));

  console.log(`Found ${toProcess.length} events without embeddings`);

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (event) => {
        try {
          const embedding = await generateEventEmbedding(event);
          await db.update(events).set({ embedding }).where(eq(events.id, event.id));
          processed++;
          console.log(`  [${processed}/${toProcess.length}] Event: ${event.title}`);
        } catch (err) {
          failed++;
          console.error(`  Failed event ${event.id} (${event.title}):`, err);
        }
      }),
    );
    if (i + BATCH_SIZE < toProcess.length) {
      await sleep(DELAY_MS);
    }
  }

  return { processed, failed };
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is required. Set it in .env.local or environment.");
    process.exit(1);
  }

  console.log("Starting embedding backfill...\n");

  const groupResult = await backfillGroupEmbeddings();
  console.log(`\nGroups: ${groupResult.processed} processed, ${groupResult.failed} failed\n`);

  const eventResult = await backfillEventEmbeddings();
  console.log(`\nEvents: ${eventResult.processed} processed, ${eventResult.failed} failed`);

  console.log("\nBackfill complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

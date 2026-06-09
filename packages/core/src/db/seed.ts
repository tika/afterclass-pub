import { config } from "dotenv";

config({ path: ".env.local" });

import { faker } from "@faker-js/faker";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { events, flyerSubmissions, groups } from "./schema.js";

// ─── Config ──────────────────────────────────────────────────────────────────

const NUM_GROUPS = 12;
const NUM_EVENTS = 40;

const GROUP_CATEGORIES = [
  "Academic",
  "Arts & Culture",
  "Community Service",
  "Cultural",
  "Greek Life",
  "Political",
  "Professional",
  "Religious",
  "Social",
  "Sports & Recreation",
] as const;

const LOCATION_NAMES = [
  "Student Union",
  "Main Quad",
  "University Library",
  "Recreation Center",
  "Black Box Theater",
  "Gymnasium",
  "Campus Lawn",
  "Science Building Atrium",
  "Engineering Hall",
  "Outdoor Amphitheater",
  "Dining Commons",
  "Faculty Lounge",
  "Student Center Ballroom",
  "Rooftop Terrace",
];

const CLUB_SUFFIXES = [
  "Club",
  "Society",
  "Association",
  "Council",
  "League",
  "Alliance",
  "Collective",
  "Network",
  "Organization",
  "Chapter",
];

const EVENT_TYPES = [
  "Mixer",
  "Workshop",
  "Info Session",
  "Social",
  "General Meeting",
  "Fundraiser",
  "Showcase",
  "Kickoff",
  "Tournament",
  "Panel Discussion",
  "Networking Event",
  "Open Mic Night",
  "Game Night",
  "Study Hall",
  "End of Semester Party",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickMultiple<T>(arr: T[], min: number, max: number): T[] {
  return faker.helpers.arrayElements(arr, {
    min,
    max: Math.min(max, arr.length),
  });
}

function placeholderImage(width: number, height: number): string {
  const seed = faker.string.alphanumeric(10);
  return `https://picsum.photos/seed/${seed}/${width}/${height}`;
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  const url = process.env.DATABASE_RUNTIME_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_RUNTIME_URL or DATABASE_URL is not set in .env");

  const isLocal = url.includes("localhost") || url.includes("127.0.0.1") || url.includes("::1");

  if (!isLocal) {
    console.error("❌ Refusing to seed: DATABASE_RUNTIME_URL does not point to a local database.");
    console.error("   Seed scripts delete all data. Only run against a local DB.");
    process.exit(1);
  }

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  console.log("🌱 Seeding local database...\n");

  // Clear existing data (order matters due to FK constraints)
  console.log("🗑️  Clearing existing data...");
  await db.delete(flyerSubmissions); // references events (no cascade)
  await db.delete(events); // references groups; cascades event_reminders, scheduled_notifications
  await db.delete(groups); // cascades group_members, group_follows

  // ── Groups ──────────────────────────────────────────────────────────────

  console.log(`👥 Creating ${NUM_GROUPS} groups...`);

  const groupRows = Array.from({ length: NUM_GROUPS }, () => ({
    name: `${faker.word.adjective({ strategy: "closest" })} ${pickRandom(CLUB_SUFFIXES)}`,
    bio: faker.lorem.paragraph({ min: 1, max: 3 }),
    logoUrl: placeholderImage(200, 200),
    bannerUrl: placeholderImage(1200, 400),
    instagram: `@${faker.internet
      .username()
      .toLowerCase()
      .replace(/[^a-z0-9._]/g, "")}`,
    website: faker.internet.url(),
    categories: pickMultiple([...GROUP_CATEGORIES], 1, 3),
  }));

  const insertedGroups = await db.insert(groups).values(groupRows).returning();
  console.log(`   ✓ ${insertedGroups.length} groups created`);

  // ── Events ──────────────────────────────────────────────────────────────

  console.log(`📅 Creating ${NUM_EVENTS} events...`);

  const now = new Date();
  const pastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const eventRows = Array.from({ length: NUM_EVENTS }, () => {
    const group = pickRandom(insertedGroups);
    const startTime = faker.date.between({ from: pastWeek, to: nextMonth });
    const durationHours = faker.number.int({ min: 1, max: 4 });
    const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);
    const isPast = startTime < now;

    return {
      title: `${pickRandom(EVENT_TYPES)} — ${faker.word.adjective()} ${faker.date.month()}`,
      description: faker.lorem.paragraphs({ min: 1, max: 3 }),
      flyerImages: [placeholderImage(600, 900)],
      startTime,
      endTime,
      locationName: pickRandom(LOCATION_NAMES),
      locationDetail: faker.helpers.maybe(
        () => `Room ${faker.number.int({ min: 100, max: 599 })}`,
        { probability: 0.4 },
      ),
      address: faker.location.streetAddress({ useFullAddress: true }),
      lat: faker.location.latitude({ min: 37.5, max: 42.5 }),
      lng: faker.location.longitude({ min: -122, max: -71 }),
      // Past events are archived; upcoming events are mostly published
      status: isPast
        ? ("ARCHIVED" as const)
        : faker.helpers.weightedArrayElement([
            { value: "PUBLISHED" as const, weight: 7 },
            { value: "DRAFT" as const, weight: 2 },
            { value: "CANCELLED" as const, weight: 1 },
          ]),
      groupId: group.id,
    };
  });

  const insertedEvents = await db.insert(events).values(eventRows).returning();
  console.log(`   ✓ ${insertedEvents.length} events created`);

  // ── Summary ─────────────────────────────────────────────────────────────

  const published = insertedEvents.filter((e) => e.status === "PUBLISHED").length;
  const draft = insertedEvents.filter((e) => e.status === "DRAFT").length;
  const archived = insertedEvents.filter((e) => e.status === "ARCHIVED").length;
  const cancelled = insertedEvents.filter((e) => e.status === "CANCELLED").length;

  console.log(`
✅ Done!
   Groups:  ${insertedGroups.length}
   Events:  ${insertedEvents.length} (${published} published, ${draft} draft, ${archived} archived, ${cancelled} cancelled)
`);

  await client.end();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});

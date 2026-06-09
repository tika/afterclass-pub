// Taking the groups from Tufts website and generating extra info w/ AI
// API: https://api.presence.io/tufts/v1/organizations

// Note: I used Cursor to generate this script last time, wasted $5 on LLM credits and it didn't work
// Back to manual coding, apologies if there's a lot of yap

// Tasks:
// LLM
//  - Summarize description into a bio
//  - Create an emoji for each group
//  => Write this progress to a JSON file so we don't lose it ever (safety)
// Create record in database with values
// Using the emoji, create a profile picture
// S3
//  - Upload file to S3
//  - Upload banner to S3
//  => Write this progress to a JSON file
// Update record with S3 values

import { access, appendFile, readFile, writeFile } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { promisify } from "node:util";
import { GoogleGenAI } from "@google/genai";
import postgres from "postgres";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const appendFileAsync = promisify(appendFile);
const writeFileAsync = promisify(writeFile);
const readFileAsync = promisify(readFile);
const accessAsync = promisify(access);

import { getGroupBannerKey, getGroupLogoKey, uploadFile } from "@afterclass/core/lib/s3";

interface PresenceAPIResponse {
  subdomain: "tufts";
  campusName: "Tufts University";
  name: string;
  description: string;
  uri: string;
  hasCoverImage: boolean;
  photoUri: string;
  photoType: "upload";
  photoUriWithVersion: string;
  memberCount: number;
  categories: string[];
  orgMember: boolean;
  newOrg: boolean;
  hasUpcomingEvents: boolean;
}

type SavedLLMProgress = {
  club: string;
  bio: string;
  emoji: string;
};

async function appendObjectToFile(fileName: string, object: unknown) {
  const PROGRESS_FILE = join(process.cwd(), "scripts", `${fileName}.json`);

  try {
    await appendFileAsync(PROGRESS_FILE, `${JSON.stringify(object)}\n`);
  } catch (error) {
    console.error(`Failed to append to ${fileName}:`, error);
    throw error;
  }
}

// Replaces file contents
async function saveObjectToFile(fileName: string, object: unknown) {
  const PROGRESS_FILE = join(process.cwd(), "scripts", `${fileName}.json`);

  try {
    await writeFileAsync(PROGRESS_FILE, JSON.stringify(object, null, 2));
  } catch (err) {
    console.error(`Failed to save ${fileName}:`, err);
    throw err;
  }
}

// Read existing progress file if it exists
async function readProgressFile<T>(fileName: string): Promise<T[]> {
  const PROGRESS_FILE = join(process.cwd(), "scripts", `${fileName}.json`);

  try {
    await accessAsync(PROGRESS_FILE);
    const content = await readFileAsync(PROGRESS_FILE, "utf-8");
    // Handle both JSON array and newline-delimited JSON
    if (content.trim().startsWith("[")) {
      return JSON.parse(content) as T[];
    }
    // Handle newline-delimited JSON
    return content
      .trim()
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as T);
  } catch {
    // File doesn't exist, return empty array
    return [];
  }
}

// Run a single prompt through the LLM
async function runPrompt(ai: GoogleGenAI, prompt: string): Promise<{ result: string }> {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
  });

  return { result: response.text || "" };
}

const LLM_SYSTEM_PROMPT = (name: string, desc: string) => `
# Context
You have two tasks: one is to write a bio for an organization on a university-specific social media, and the other is to assign a single emoji to the organization.
You are provided the name and a short description of an organization with the goal of writing 1-2 sentences stating what the organization does, and choosing an emoji.

# Things to note
* In the UI, the organization's name is already present, so there isn't a direct need to specify it in the bio
* The bio should feel semi-professional, but casual in the sense that they are student-run organizations
* This is a university-specific social media, so there is no explicit need to specify the university's name in the bio
* Social media and relevant links are already visible in the UI. Do not include links or social media handles in the bio.

# Output Format
Your output MUST be the emoji followed by a single comma and then the biography, like so:
<EMOJI>, <BIO>

# Examples
## Example A
**Input**
Name: 180 Degrees Consulting
Description: 180 Degrees Consulting is the world's largest consultancy for non-profits and social enterprises, with operations in 35 countries and more than 7000 consultants worldwide. We aim to improve education, reduce homelessness, and alleviate poverty by helping non-profits and social enterprises to receive the support they need to improve and expand their services.Founded during the Fall 2013 semester and winner of that year's 'Best New Branch' award, the Tufts branch of 180 Degrees Consulting has quickly built a reputation of excellent client work and a commitment to social impact. Every semester, student consultants have the opportunity to partake in hands-on semester-long projects, with projects scopes ranging from marketing campaigns to financial analysis, and everything else in between.
**Output**
🌍, The Tufts branch of the world's largest social impact consultancy

## Example B
**Input**
Name: African American Foundations and Roots Organization (AAFRO)
Description: The African American Foundations and Roots Organization is dedicated to honoring the significant contributions and the rich cultural heritage of Generational African Americans. Through dynamic programming and thought-provoking dialogue, we strive to foster an in-depth understanding and appreciation of African American history, culture, and achievements. African American Foundations and Roots Organization aims to celebrate the varying diverse cultures and indispensable contributions of Generational African Americans at Tufts University by hosting uplifting events and engaging in intellectual discussions. We, as a student organization, find it imperative to preserve components of our ethnic background such as, the lived experiences, culture, and contributions of Generational African Americans, as observed in recent years the erasure of our culture. The banning of courses such as Advanced Placement African American studies in secondary schools and various other attempts by politicians, public figures, and other individuals to diminish our culture has only heightened the need for spaces like AAFRO at institutions across the United States. Spaces like AAFRO give students who share a Generational African American background the opportunity to further engage with their heritage, create community, and explore the intricacies of their ethnicity.Meetings and other programming happens frequently, with around 2-4 events per month.

**Output**
🌱, Dedicated to honoring the significant contributions and heritage of Generational Black/African Americans through programming and intellectual dialogue


# Task
Take this description and generate a bio and emoji. Your output MUST be the emoji followed by a single comma and then the biography (bio is 1-2 sentences).

# Your turn
**Input**
Name: ${name}
Description: ${desc}
**Output**
`;

// Chunk an array into smaller arrays
function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size),
  );
}

async function generateBioAndEmoji(
  orgData: { name: string; description: string }[],
): Promise<SavedLLMProgress[]> {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENAI_API_KEY environment variable is required");
  }

  // Check for existing progress
  const existingProgress = await readProgressFile<SavedLLMProgress>("llm-data-complete");
  const existingMap = new Map(existingProgress.map((p) => [p.club, p]));

  // Filter out organizations that already have LLM data
  const orgsToProcess = orgData.filter((org) => {
    if (!org.description || org.description.trim() === "") {
      console.warn(`Skipping ${org.name}: missing description`);
      return false;
    }
    if (existingMap.has(org.name)) {
      console.log(`Skipping ${org.name}: already has LLM data`);
      return false;
    }
    return true;
  });

  if (orgsToProcess.length === 0) {
    console.log("All organizations already have LLM data, skipping generation");
    return existingProgress;
  }

  console.log(
    `Processing ${orgsToProcess.length} organizations (${orgData.length - orgsToProcess.length} already done)`,
  );

  const ai = new GoogleGenAI({ apiKey });

  // Create batches of 50
  const batches = chunk(orgsToProcess, 50);
  const progress: SavedLLMProgress[] = [...existingProgress];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    console.log(`Running batch ${i + 1}/${batches.length}`);

    const results = await Promise.all(
      batch.map(async (org) => {
        const prompt = LLM_SYSTEM_PROMPT(org.name, org.description);
        const response = await runPrompt(ai, prompt);

        // Parse "EMOJI, BIO" format from response
        const text = response.result.trim();
        const commaIndex = text.indexOf(",");
        const emoji = commaIndex > 0 ? text.slice(0, commaIndex).trim() : "🏛️";
        const bio = commaIndex > 0 ? text.slice(commaIndex + 1).trim() : text;

        return {
          club: org.name,
          bio,
          emoji,
        };
      }),
    );

    progress.push(...results);

    // Persist progress after each batch (append mode to not lose data)
    for (const result of results) {
      await appendObjectToFile("llm-data", result);
    }

    // Optional: small delay to avoid rate limits
    if (i < batches.length - 1) {
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  // Final save with complete progress
  await saveObjectToFile("llm-data-complete", progress);
  return progress;
}

async function generateEmojiLogo(emoji: string, size = 512, isFallback = false): Promise<Buffer> {
  // Extract first emoji if multiple are present (handle compound emojis)
  const firstEmoji = emoji.trim().split(/\s/)[0] || "🏛️";
  const emojiUrl = `https://emojicdn.elk.sh/${encodeURIComponent(firstEmoji)}?style=apple`; // s/o to Ben Borgers!

  try {
    const response = await fetch(emojiUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch emoji: ${firstEmoji} (${response.status})`);
    }

    const emojiBuffer = Buffer.from(await response.arrayBuffer());

    const emojiSize = Math.floor(size * 0.6);
    const offset = Math.floor((size - emojiSize) / 2);

    const resizedEmoji = await sharp(emojiBuffer).resize(emojiSize, emojiSize).toBuffer();

    return sharp({
      create: { width: size, height: size, channels: 4, background: "#000" },
    })
      .composite([{ input: resizedEmoji, left: offset, top: offset }])
      .png()
      .toBuffer();
  } catch (error) {
    // If this is already a fallback attempt, just return a black square
    if (isFallback) {
      console.warn(`Failed to generate fallback logo, creating blank square for emoji "${emoji}"`);
      return sharp({
        create: { width: size, height: size, channels: 4, background: "#000" },
      })
        .png()
        .toBuffer();
    }
    console.warn(`Failed to generate logo for emoji "${emoji}", using fallback:`, error);
    // Fallback: generate a simple black square with a default emoji
    return generateEmojiLogo("🏛️", size, true);
  }
}

async function run() {
  const databaseUrl = process.env.DATABASE_RUNTIME_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("ERROR: No database URL");
  }

  const sql = postgres(databaseUrl, {
    onnotice: () => {},
    prepare: false,
  });

  try {
    const res: PresenceAPIResponse[] = await fetch(
      "https://api.presence.io/tufts/v1/organizations",
    ).then((res) => res.json());

    // Validate API response
    if (!Array.isArray(res)) {
      throw new Error("Invalid API response: expected array");
    }

    // Filter out organizations without descriptions
    const validOrgs = res.filter((it) => {
      if (!it.name || !it.description || it.description.trim() === "") {
        console.warn(`Skipping invalid organization: ${it.name || "unknown"}`);
        return false;
      }
      return true;
    });

    const biosAndEmojis = await generateBioAndEmoji(
      validOrgs.map((it) => ({
        name: it.name, // we can guarantee this is unique
        description: it.description,
      })),
    );

    // Create records in database for each organization
    const createdGroupIds: string[] = [];
    for (const org of biosAndEmojis) {
      const [record] = await sql`
				INSERT INTO groups (name, bio)
				VALUES (${org.club}, ${org.bio})
				RETURNING id
			`;

      if (record) {
        console.log(`Created group: ${org.club} with id: ${record.id}`);
        createdGroupIds.push(record.id);
      } else {
        console.log(`Group already exists: ${org.club}`);
      }
    }

    // Now, we need to create the emoji images using `generateEmojiLogo` and upload to S3
    // Also, we should upload the banner to S3. URLs for that are in the form
    // https://tufts-cdn.presence.io/organization-photos/dd548608-7fbb-40e9-bae2-7cc77e0cd9b7/${photoUri}

    // Store under groups/${groupId}/logos/${randomIdentifier} and groups/${groupId}/banners/${randomIdentifier}

    // Check for existing S3 upload progress
    const existingS3Progress = await readProgressFile<{
      club: string;
      logoUrl?: string;
      bannerUrl?: string;
      timestamp: string;
    }>("s3-upload-progress");
    const s3ProgressMap = new Map(
      existingS3Progress.map((p) => [p.club, { logoUrl: p.logoUrl, bannerUrl: p.bannerUrl }]),
    );

    // Fetch only groups that were processed in this run (by name)
    const processedGroupNames = new Set(biosAndEmojis.map((o) => o.club));
    const groups = (await sql`
			SELECT id, name, logo_url, banner_url FROM groups
			WHERE name = ANY(${Array.from(processedGroupNames)})
		`) as Array<{
      id: string;
      name: string;
      logo_url: string | null;
      banner_url: string | null;
    }>;

    // Create a map of org name to org data for quick lookup
    const orgMap = new Map(biosAndEmojis.map((o) => [o.club, o]));
    const apiMap = new Map(validOrgs.map((o) => [o.name, o]));

    // Filter out groups that already have both logo and banner uploaded
    const groupsToProcess = groups.filter((group) => {
      const progress = s3ProgressMap.get(group.name);
      // Skip if already has both logo and banner in progress file
      if (progress?.logoUrl && progress?.bannerUrl) {
        console.log(`Skipping ${group.name}: already has logo and banner uploaded`);
        return false;
      }
      // Also skip if already has both in database
      if (group.logo_url && group.banner_url) {
        console.log(`Skipping ${group.name}: already has logo and banner in database`);
        return false;
      }
      return true;
    });

    if (groupsToProcess.length === 0) {
      console.log("All groups already have S3 uploads, skipping");
      return;
    }

    console.log(
      `Processing ${groupsToProcess.length} groups (${groups.length - groupsToProcess.length} already done)`,
    );

    // Process in batches of 20
    const batchSize = 20;
    const groupBatches = chunk(groupsToProcess, batchSize);

    for (let i = 0; i < groupBatches.length; i++) {
      const batch = groupBatches[i];
      console.log(
        `Processing S3 upload batch ${i + 1}/${groupBatches.length} (${batch.length} groups)`,
      );

      // Process batch concurrently
      await Promise.all(
        batch.map(async (group) => {
          const orgData = orgMap.get(group.name);
          const apiData = apiMap.get(group.name);

          if (!orgData) {
            console.log(`No LLM data found for group: ${group.name}`);
            return;
          }

          const progress = s3ProgressMap.get(group.name);
          let logoUrl: string | undefined = progress?.logoUrl;
          let bannerUrl: string | undefined = progress?.bannerUrl;

          // Generate and upload emoji logo if not already done
          if (!logoUrl && !group.logo_url) {
            try {
              const logoBuffer = await generateEmojiLogo(orgData.emoji, 512);
              const logoKey = getGroupLogoKey(group.id, "png");
              logoUrl = await uploadFile(logoKey, logoBuffer, "image/png");
              console.log(`Uploaded logo for ${group.name}: ${logoUrl}`);
            } catch (error) {
              console.error(`Failed to upload logo for ${group.name}:`, error);
            }
          } else {
            logoUrl = logoUrl || group.logo_url || undefined;
            console.log(`Skipping logo upload for ${group.name}: already exists`);
          }

          // Upload banner if available and not already done
          if (!bannerUrl && !group.banner_url && apiData?.photoUri) {
            try {
              const bannerResponse = await fetch(
                `https://tufts-cdn.presence.io/organization-photos/dd548608-7fbb-40e9-bae2-7cc77e0cd9b7/${apiData.photoUri}`,
              );
              if (bannerResponse.ok) {
                const bannerBuffer = Buffer.from(await bannerResponse.arrayBuffer());
                const bannerKey = getGroupBannerKey(group.id, "jpg");
                bannerUrl = await uploadFile(bannerKey, bannerBuffer, "image/jpeg");
                console.log(`Uploaded banner for ${group.name}: ${bannerUrl}`);
              }
            } catch (error) {
              console.error(`Failed to upload banner for ${group.name}:`, error);
            }
          } else {
            bannerUrl = bannerUrl || group.banner_url || undefined;
            if (bannerUrl) {
              console.log(`Skipping banner upload for ${group.name}: already exists`);
            }
          }

          // Update the database with the URLs
          if (logoUrl && !group.logo_url) {
            await sql`
							UPDATE groups
							SET logo_url = ${logoUrl}
							WHERE id = ${group.id}
						`;
          }
          if (bannerUrl && !group.banner_url) {
            await sql`
							UPDATE groups
							SET banner_url = ${bannerUrl}
							WHERE id = ${group.id}
						`;
          }
          if (logoUrl || bannerUrl) {
            console.log(`Updated group ${group.name} with S3 URLs`);
          }

          // Persist progress
          await appendObjectToFile("s3-upload-progress", {
            club: group.name,
            logoUrl,
            bannerUrl,
            timestamp: new Date().toISOString(),
          });
        }),
      );

      // Optional delay between batches
      if (i < groupBatches.length - 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  } catch (error) {
    console.error("Fatal error in run():", error);
    throw error;
  } finally {
    await sql.end();
  }
}

run().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});

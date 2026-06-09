// Backfill events from Presence.io API into the AfterClass database
// API url: https://api.presence.io/tufts/v1/events
// Photo URL pattern: https://tufts-cdn.presence.io/event-photos/dd548608-7fbb-40e9-bae2-7cc77e0cd9b7/{photoUri}

import { access, appendFile, readFile, writeFile } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import postgres from "postgres";

import { compareTwoStrings } from "@afterclass/core/lib/stringSimilarity";
import { getEventFlyerKey, uploadFile } from "@afterclass/core/lib/s3";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Event data from Presence.io API
 */
type PresenceEvent = {
  eventName: string;
  uri: string;
  organizationName: string;
  description: string;
  location: string; // Could be a physical location or Zoom link
  isVirtualEventLink: boolean;
  photoUri: string;
  startDateTimeUtc: string; // ISO 8601 format with 'Z' suffix
  endDateTimeUtc: string;
  tags: string[];
};

/**
 * Progress record for successfully processed events
 */
type ProcessedEvent = {
  presenceUri: string;
  eventId: string;
  groupId: string;
  groupName: string;
  timestamp: string;
};

/**
 * Record for events that couldn't be matched to a group
 */
type UnmatchedEvent = {
  presenceUri: string;
  eventName: string;
  organizationName: string;
  bestMatchName: string | null;
  confidence: number;
  timestamp: string;
};

/**
 * Result from Google Maps geocoding API
 */
type GoogleGeocodeResult = {
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  address_components: Array<{
    short_name: string;
    long_name: string;
    types: string[];
  }>;
};

type GoogleGeocodeResponse = {
  status: string;
  results: GoogleGeocodeResult[];
};

/**
 * POI record from database
 */
type POI = {
  id: string;
  name: string;
  aliases: string[] | null;
  address: string | null;
  lat: number;
  lng: number;
};

/**
 * Processed location data
 */
type LocationData = {
  locationName: string;
  locationDetail: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

// ============================================================================
// File System Helpers (following backfillOrgs.ts patterns)
// ============================================================================

const appendFileAsync = promisify(appendFile);
const writeFileAsync = promisify(writeFile);
const readFileAsync = promisify(readFile);
const accessAsync = promisify(access);

/**
 * Append an object as a JSON line to a file
 */
async function appendObjectToFile(fileName: string, object: unknown) {
  const filePath = join(process.cwd(), "scripts", "backfillEvents", `${fileName}.json`);
  try {
    await appendFileAsync(filePath, `${JSON.stringify(object)}\n`);
  } catch (error) {
    console.error(`Failed to append to ${fileName}:`, error);
    throw error;
  }
}

/**
 * Save an object as formatted JSON to a file (replaces contents)
 */
async function _saveObjectToFile(fileName: string, object: unknown) {
  const filePath = join(process.cwd(), "scripts", "backfillEvents", `${fileName}.json`);
  try {
    await writeFileAsync(filePath, JSON.stringify(object, null, 2));
  } catch (err) {
    console.error(`Failed to save ${fileName}:`, err);
    throw err;
  }
}

/**
 * Read progress file, handling both JSON array and newline-delimited formats
 */
async function readProgressFile<T>(fileName: string): Promise<T[]> {
  const filePath = join(process.cwd(), "scripts", "backfillEvents", `${fileName}.json`);
  try {
    await accessAsync(filePath);
    const content = await readFileAsync(filePath, "utf-8");
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

/**
 * Split an array into chunks of a given size
 */
function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size),
  );
}

// ============================================================================
// Organization Matching
// ============================================================================

const FUZZY_MATCH_THRESHOLD = 0.4;

/**
 * Find the best matching group for an organization name
 * Returns the matched group and confidence score
 */
async function fuzzyMatchGroup(
  orgName: string,
  allGroups: Array<{ id: string; name: string; logo_url: string | null }>,
): Promise<{
  group: { id: string; name: string; logo_url: string | null } | null;
  confidence: number;
}> {
  if (!orgName || orgName.trim().length === 0) {
    return { group: null, confidence: 0 };
  }

  if (allGroups.length === 0) {
    return { group: null, confidence: 0 };
  }

  const normalizedInput = orgName.trim().toLowerCase();
  let bestMatch: { id: string; name: string; logo_url: string | null } | null = null;
  let bestScore = 0;

  // Find the best match using string similarity
  for (const group of allGroups) {
    const normalizedName = group.name.trim().toLowerCase();
    const score = compareTwoStrings(normalizedInput, normalizedName);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = group;
    }
  }

  // Return null group if below threshold
  if (bestScore < FUZZY_MATCH_THRESHOLD || !bestMatch) {
    return { group: null, confidence: bestScore };
  }

  return { group: bestMatch, confidence: bestScore };
}

// ============================================================================
// Location Processing
// ============================================================================

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in meters
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Medford/Tufts area bounding box for geocoding bias
const MEDFORD_BOUNDS = {
  north: 42.45,
  south: 42.35,
  east: -71.05,
  west: -71.2,
};

/**
 * Use Google Maps API to geocode a location string
 * Results are biased towards the Medford/Tufts area and restricted to Massachusetts
 */
async function geocodeLocation(
  location: string,
  googleMapsApiKey: string,
): Promise<{ lat: number; lng: number; address: string } | null> {
  const bounds = `${MEDFORD_BOUNDS.south},${MEDFORD_BOUNDS.west}|${MEDFORD_BOUNDS.north},${MEDFORD_BOUNDS.east}`;

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", location);
  url.searchParams.set("key", googleMapsApiKey);
  url.searchParams.set("bounds", bounds);
  url.searchParams.set("components", "country:US|administrative_area:MA");

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      console.warn(`Google Maps geocoding failed for "${location}": ${response.status}`);
      return null;
    }

    const data = (await response.json()) as GoogleGeocodeResponse;
    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      console.warn(`No geocoding results for "${location}"`);
      return null;
    }

    // Filter to only include Massachusetts results
    const maResults = data.results.filter((result) => {
      const stateComponent = result.address_components.find((c) =>
        c.types.includes("administrative_area_level_1"),
      );
      return stateComponent?.short_name === "MA";
    });

    if (maResults.length === 0) {
      console.warn(`No Massachusetts results for "${location}"`);
      return null;
    }

    const result = maResults[0];
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      address: result.formatted_address,
    };
  } catch (error) {
    console.error(`Geocoding error for "${location}":`, error);
    return null;
  }
}

/**
 * Find a matching POI within 50 meters of the given coordinates
 */
function findMatchingPOI(
  lat: number,
  lng: number,
  address: string | null,
  pois: POI[],
): POI | null {
  const MATCH_RADIUS_METERS = 50;

  for (const poi of pois) {
    // Check exact address match first
    if (address && poi.address && poi.address.toLowerCase() === address.toLowerCase()) {
      return poi;
    }

    // Check distance
    const distance = haversineDistance(lat, lng, poi.lat, poi.lng);
    if (distance <= MATCH_RADIUS_METERS) {
      return poi;
    }
  }

  return null;
}

/**
 * Process a location string and return structured location data
 * Handles virtual events, geocoding, and POI matching
 *
 * Strategy: Store the original location string as locationDetail (room info, etc. is too
 * varied to parse reliably). Use geocoding/POI for locationName and coordinates.
 */
async function processLocation(
  location: string,
  isVirtualEventLink: boolean,
  pois: POI[],
  googleMapsApiKey: string,
): Promise<LocationData> {
  // For virtual events, just use the location string as the name
  // Don't set coordinates or address
  if (isVirtualEventLink) {
    return {
      locationName: location || "Virtual Event",
      locationDetail: null,
      address: null,
      lat: null,
      lng: null,
    };
  }

  // Store the original location string as locationDetail
  // Examples: "Tisch Library Austin Conference Room, Room 226", "Mayer Campus Center : 250"
  const locationDetail = location || null;

  // Try to geocode the location
  const geocodeResult = await geocodeLocation(location, googleMapsApiKey);

  if (!geocodeResult) {
    // Geocoding failed, just use the raw location string as the name
    return {
      locationName: location,
      locationDetail,
      address: null,
      lat: null,
      lng: null,
    };
  }

  // Check if there's a matching POI
  const matchingPOI = findMatchingPOI(
    geocodeResult.lat,
    geocodeResult.lng,
    geocodeResult.address,
    pois,
  );

  if (matchingPOI) {
    // Use POI's name as the location name (more recognizable)
    return {
      locationName: matchingPOI.name,
      locationDetail,
      address: matchingPOI.address || geocodeResult.address,
      lat: matchingPOI.lat,
      lng: matchingPOI.lng,
    };
  }

  // No POI match, use geocoded data
  // Try to extract a cleaner name from the address
  const addressParts = geocodeResult.address.split(",");
  const locationName = addressParts[0]?.trim() || location;

  return {
    locationName,
    locationDetail,
    address: geocodeResult.address,
    lat: geocodeResult.lat,
    lng: geocodeResult.lng,
  };
}

// ============================================================================
// Image Handling
// ============================================================================

/**
 * Download an image from a URL and return as a Buffer
 */
async function downloadImage(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to download image from ${url}: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await response.arrayBuffer());
    return { buffer, contentType };
  } catch (error) {
    console.error(`Error downloading image from ${url}:`, error);
    return null;
  }
}

/**
 * Get file extension from content type
 */
function getExtensionFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[contentType] || "jpg";
}

// ============================================================================
// HTML Processing
// ============================================================================

/**
 * Strip HTML tags from a string
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/&nbsp;/g, " ") // Replace nbsp
    .replace(/&amp;/g, "&") // Replace ampersand
    .replace(/&lt;/g, "<") // Replace less than
    .replace(/&gt;/g, ">") // Replace greater than
    .replace(/&quot;/g, '"') // Replace quote
    .replace(/&#39;/g, "'") // Replace apostrophe
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

// ============================================================================
// Main Script
// ============================================================================

/** Presence.io photo CDN base URL */
const PRESENCE_PHOTO_CDN =
  "https://tufts-cdn.presence.io/event-photos/dd548608-7fbb-40e9-bae2-7cc77e0cd9b7";

async function run() {
  console.log("=".repeat(60));
  console.log("Starting Presence.io Events Backfill");
  console.log("=".repeat(60));

  // -------------------------------------------------------------------------
  // Step 0: Validate environment variables
  // -------------------------------------------------------------------------
  const databaseUrl = process.env.DATABASE_RUNTIME_URL || process.env.DATABASE_URL;
  const googleMapsApiKey =
    process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!databaseUrl) {
    throw new Error("DATABASE_RUNTIME_URL or DATABASE_URL environment variable is required");
  }
  if (!googleMapsApiKey) {
    throw new Error(
      "GOOGLE_MAPS_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY environment variable is required",
    );
  }

  const sql = postgres(databaseUrl, {
    onnotice: () => {},
    prepare: false,
  });

  try {
    // -------------------------------------------------------------------------
    // Step 1: Fetch events from Presence API
    // -------------------------------------------------------------------------
    console.log("\n[Step 1] Fetching events from Presence.io API...");

    const response = await fetch("https://api.presence.io/tufts/v1/events");
    if (!response.ok) {
      throw new Error(`Presence API returned ${response.status}`);
    }

    const presenceEvents: PresenceEvent[] = await response.json();

    if (!Array.isArray(presenceEvents)) {
      throw new Error("Invalid API response: expected array");
    }

    console.log(`Fetched ${presenceEvents.length} events from Presence.io`);

    // Filter out events with missing required fields
    const validEvents = presenceEvents.filter((event) => {
      if (!event.eventName || !event.uri || !event.organizationName) {
        console.warn(
          `Skipping event with missing required fields: ${event.eventName || "unknown"}`,
        );
        return false;
      }
      if (!event.startDateTimeUtc) {
        console.warn(`Skipping event without start time: ${event.eventName}`);
        return false;
      }
      return true;
    });

    console.log(`${validEvents.length} events have all required fields`);

    // -------------------------------------------------------------------------
    // Step 2: Load existing progress and skip already processed events
    // -------------------------------------------------------------------------
    console.log("\n[Step 2] Loading existing progress...");

    const existingProgress = await readProgressFile<ProcessedEvent>("events-backfill-progress");
    const processedUris = new Set(existingProgress.map((p) => p.presenceUri));

    const eventsToProcess = validEvents.filter((event) => !processedUris.has(event.uri));

    console.log(`${existingProgress.length} events already processed`);
    console.log(`${eventsToProcess.length} events remaining to process`);

    if (eventsToProcess.length === 0) {
      console.log("All events already processed, nothing to do!");
      return;
    }

    // -------------------------------------------------------------------------
    // Step 3: Load groups and POIs from database
    // -------------------------------------------------------------------------
    console.log("\n[Step 3] Loading groups and POIs from database...");

    const allGroups = (await sql`
			SELECT id, name, logo_url FROM groups
		`) as Array<{ id: string; name: string; logo_url: string | null }>;

    const allPOIs = (await sql`
			SELECT id, name, aliases, address, lat, lng FROM points_of_interest
		`) as POI[];

    console.log(`Loaded ${allGroups.length} groups and ${allPOIs.length} POIs`);

    // -------------------------------------------------------------------------
    // Step 4: Process events in batches
    // -------------------------------------------------------------------------
    console.log("\n[Step 4] Processing events...");

    const BATCH_SIZE = 20;
    const batches = chunk(eventsToProcess, BATCH_SIZE);

    let processedCount = 0;
    let unmatchedCount = 0;
    let errorCount = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`\n--- Batch ${batchIndex + 1}/${batches.length} (${batch.length} events) ---`);

      // Process events concurrently within batch
      await Promise.all(
        batch.map(async (presenceEvent) => {
          try {
            // ---------------------------------------------------------
            // Step 4a: Match organization to group
            // ---------------------------------------------------------
            const { group: matchedGroup, confidence } = await fuzzyMatchGroup(
              presenceEvent.organizationName,
              allGroups,
            );

            // If no match found, log to unmatched file and skip
            if (!matchedGroup) {
              console.log(
                `[UNMATCHED] "${presenceEvent.eventName}" - org "${presenceEvent.organizationName}" (best confidence: ${confidence.toFixed(2)})`,
              );

              const unmatchedRecord: UnmatchedEvent = {
                presenceUri: presenceEvent.uri,
                eventName: presenceEvent.eventName,
                organizationName: presenceEvent.organizationName,
                bestMatchName: null,
                confidence,
                timestamp: new Date().toISOString(),
              };
              await appendObjectToFile("unmatched-events", unmatchedRecord);
              unmatchedCount++;
              return;
            }

            console.log(
              `[MATCHED] "${presenceEvent.eventName}" -> "${matchedGroup.name}" (${(confidence * 100).toFixed(0)}%)`,
            );

            // ---------------------------------------------------------
            // Step 4b: Process location
            // ---------------------------------------------------------
            const locationData = await processLocation(
              presenceEvent.location,
              presenceEvent.isVirtualEventLink,
              allPOIs,
              googleMapsApiKey,
            );

            // ---------------------------------------------------------
            // Step 4c: Parse times (already in UTC with 'Z' suffix)
            // ---------------------------------------------------------
            const startTime = new Date(presenceEvent.startDateTimeUtc);
            const endTime = presenceEvent.endDateTimeUtc
              ? new Date(presenceEvent.endDateTimeUtc)
              : null;

            // ---------------------------------------------------------
            // Step 4d: Process description (strip HTML)
            // ---------------------------------------------------------
            const description = presenceEvent.description
              ? stripHtml(presenceEvent.description)
              : null;

            // ---------------------------------------------------------
            // Step 4e: Create event record with placeholder flyer
            // ---------------------------------------------------------
            const sourceUrl = `https://tufts.presence.io/event/${presenceEvent.uri}`;

            // Check if this event already exists in the DB (prevents duplicates on re-run)
            const [existingEvent] = (await sql`
							SELECT id FROM events WHERE source_url = ${sourceUrl}
						`) as Array<{ id: string }>;

            if (existingEvent) {
              console.log(`  [SKIP] Event already exists in DB: ${existingEvent.id}`);
              const progressRecord: ProcessedEvent = {
                presenceUri: presenceEvent.uri,
                eventId: existingEvent.id,
                groupId: matchedGroup.id,
                groupName: matchedGroup.name,
                timestamp: new Date().toISOString(),
              };
              await appendObjectToFile("events-backfill-progress", progressRecord);
              processedCount++;
              return;
            }

            const metadata = {
              tags: presenceEvent.tags || [],
              source: "presence.io",
              presenceUri: presenceEvent.uri,
            };

            // Create event with placeholder flyer URL (will update after S3 upload)
            const [createdEvent] = (await sql`
							INSERT INTO events (
								title,
								description,
								flyer_images,
								start_time,
								end_time,
								location_name,
								location_detail,
								address,
								lat,
								lng,
								status,
								source_url,
								metadata,
								group_id
							) VALUES (
								${presenceEvent.eventName},
								${description},
								${sql.array(["placeholder"])},
								${startTime},
								${endTime},
								${locationData.locationName},
								${locationData.locationDetail},
								${locationData.address},
								${locationData.lat},
								${locationData.lng},
								${"PUBLISHED"},
								${sourceUrl},
								${JSON.stringify(metadata)},
								${matchedGroup.id}
							)
							RETURNING id
						`) as Array<{ id: string }>;

            if (!createdEvent) {
              throw new Error("Failed to create event record");
            }

            // ---------------------------------------------------------
            // Step 4f: Upload flyer image to S3
            // ---------------------------------------------------------
            let flyerUrl: string;

            // Try to download the event's photo
            let imageData: { buffer: Buffer; contentType: string } | null = null;

            if (presenceEvent.photoUri) {
              const photoUrl = `${PRESENCE_PHOTO_CDN}/${presenceEvent.photoUri}`;
              imageData = await downloadImage(photoUrl);
            }

            // If no photo available, use group's logo as fallback
            if (!imageData && matchedGroup.logo_url) {
              console.log(`  Using group logo as fallback for "${presenceEvent.eventName}"`);
              imageData = await downloadImage(matchedGroup.logo_url);
            }

            if (imageData) {
              // Upload to S3
              const extension = getExtensionFromContentType(imageData.contentType);
              const flyerKey = getEventFlyerKey(createdEvent.id, extension);
              flyerUrl = await uploadFile(flyerKey, imageData.buffer, imageData.contentType);
            } else {
              // No image available at all - use a data URL placeholder
              // This is a 1x1 transparent PNG
              console.warn(
                `  No image available for "${presenceEvent.eventName}", using placeholder`,
              );
              flyerUrl = "https://placehold.co/400x600/1a1a2e/ffffff?text=No+Flyer";
            }

            // ---------------------------------------------------------
            // Step 4g: Update event with flyer URL
            // ---------------------------------------------------------
            await sql`
							UPDATE events
							SET flyer_images = ${sql.array([flyerUrl])}
							WHERE id = ${createdEvent.id}
						`;

            // ---------------------------------------------------------
            // Step 4h: Record progress
            // ---------------------------------------------------------
            const progressRecord: ProcessedEvent = {
              presenceUri: presenceEvent.uri,
              eventId: createdEvent.id,
              groupId: matchedGroup.id,
              groupName: matchedGroup.name,
              timestamp: new Date().toISOString(),
            };
            await appendObjectToFile("events-backfill-progress", progressRecord);

            processedCount++;
            console.log(`  Created event ${createdEvent.id}`);
          } catch (error) {
            console.error(`[ERROR] Failed to process "${presenceEvent.eventName}":`, error);
            errorCount++;
          }
        }),
      );

      // Small delay between batches to avoid rate limits
      if (batchIndex < batches.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // -------------------------------------------------------------------------
    // Step 5: Summary
    // -------------------------------------------------------------------------
    console.log(`\n${"=".repeat(60)}`);
    console.log("Backfill Complete!");
    console.log("=".repeat(60));
    console.log(`Events processed:  ${processedCount}`);
    console.log(`Events unmatched:  ${unmatchedCount}`);
    console.log(`Errors:            ${errorCount}`);
    console.log(`Total:             ${processedCount + unmatchedCount + errorCount}`);

    if (unmatchedCount > 0) {
      console.log(`\nCheck unmatched-events.json for events that need manual group matching`);
    }
  } catch (error) {
    console.error("Fatal error:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run the script
run().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});

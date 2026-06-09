// Re-geocode all events in the database using the location_detail field
// This script fixes incorrect coordinates/addresses from the previous Mapbox-based backfill

import postgres from "postgres";

// ============================================================================
// Type Definitions
// ============================================================================

type Event = {
  id: string;
  title: string;
  location_name: string;
  location_detail: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

type POI = {
  id: string;
  name: string;
  aliases: string[] | null;
  address: string | null;
  lat: number;
  lng: number;
};

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

// ============================================================================
// Constants
// ============================================================================

// Tufts Medford campus center
const TUFTS_CENTER = {
  lat: 42.4084,
  lng: -71.1195,
};

// Maximum distance from Tufts center to accept a geocoding result (in meters)
// ~1.5km covers both Medford and Boston (SMFA) campuses
const MAX_DISTANCE_FROM_TUFTS = 1500;

// ============================================================================
// Geocoding Functions
// ============================================================================

/**
 * Check if the location string looks like an off-campus venue
 */
function looksLikeOffCampusVenue(location: string): boolean {
  const lower = location.toLowerCase();

  // Known off-campus venue patterns
  const offCampusPatterns = [
    /fenway/i,
    /amc\s/i,
    /theater|theatre/i,
    /cinema/i,
    /museum/i,
    /\d+\s+\w+\s+(street|st|avenue|ave|road|rd|drive|dr|way|blvd|boulevard)/i, // Street addresses
    /boston\s+(common|garden|harbor)/i,
    /harvard\s+square/i,
    /davis\s+square/i,
    /park\b/i,
    /restaurant/i,
    /hotel/i,
  ];

  return offCampusPatterns.some((pattern) => pattern.test(lower));
}

/**
 * Raw geocoding call without any filtering
 */
async function rawGeocode(
  query: string,
  googleMapsApiKey: string,
): Promise<{ lat: number; lng: number; address: string } | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("key", googleMapsApiKey);

  try {
    const response = await fetch(url.toString());
    if (!response.ok) return null;

    const data = (await response.json()) as GoogleGeocodeResponse;
    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      return null;
    }

    const result = data.results[0];
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      address: result.formatted_address,
    };
  } catch {
    return null;
  }
}

/**
 * Use Google Maps API to geocode a location string
 * - First tries with "Tufts University" context
 * - Rejects results far from campus unless it looks like an off-campus venue
 * - For off-campus venues, tries direct geocoding
 */
async function geocodeLocation(
  location: string,
  googleMapsApiKey: string,
): Promise<{
  lat: number;
  lng: number;
  address: string;
  isOffCampus?: boolean;
} | null> {
  // First, try geocoding with Tufts context
  const queryWithContext = `${location}, Tufts University, Medford, MA`;
  const tuftsResult = await rawGeocode(queryWithContext, googleMapsApiKey);

  if (tuftsResult) {
    const distanceFromTufts = haversineDistance(
      tuftsResult.lat,
      tuftsResult.lng,
      TUFTS_CENTER.lat,
      TUFTS_CENTER.lng,
    );

    // If result is near Tufts, use it
    if (distanceFromTufts <= MAX_DISTANCE_FROM_TUFTS) {
      return tuftsResult;
    }
  }

  // Result was too far from Tufts or failed
  // Check if this looks like an off-campus venue
  if (looksLikeOffCampusVenue(location)) {
    // Try direct geocoding without Tufts context
    const directResult = await rawGeocode(location, googleMapsApiKey);
    if (directResult) {
      return { ...directResult, isOffCampus: true };
    }
  }

  // Can't geocode this location
  return null;
}

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

/**
 * Find a matching POI by name similarity or proximity
 */
function findMatchingPOI(
  locationString: string,
  geocodedLat: number | null,
  geocodedLng: number | null,
  pois: POI[],
): POI | null {
  const locationLower = locationString.toLowerCase();

  // First, try exact name match or alias match
  for (const poi of pois) {
    const poiNameLower = poi.name.toLowerCase();

    // Check if POI name is contained in location string
    if (locationLower.includes(poiNameLower)) {
      return poi;
    }

    // Check aliases
    if (poi.aliases) {
      for (const alias of poi.aliases) {
        if (locationLower.includes(alias.toLowerCase())) {
          return poi;
        }
      }
    }
  }

  // If we have geocoded coordinates, check for proximity match
  if (geocodedLat !== null && geocodedLng !== null) {
    const MATCH_RADIUS_METERS = 50;

    for (const poi of pois) {
      const distance = haversineDistance(geocodedLat, geocodedLng, poi.lat, poi.lng);
      if (distance <= MATCH_RADIUS_METERS) {
        return poi;
      }
    }
  }

  return null;
}

/**
 * Extract a clean location name from the location_detail string
 */
function extractLocationName(locationDetail: string): string {
  // Common patterns in location_detail:
  // "Tisch Library Austin Conference Room, Room 226"
  // "Mayer Campus Center : 250"
  // "Sophia Gordon Hall, Sophia Gordon Hall, Sophia Gordon Multipurpose Room"
  // "JCC Hillel Center - 220 Packard Avenue"

  // Remove room numbers and specific details
  const name = locationDetail
    // Remove "Room XXX" or ", XXX" patterns at the end
    .replace(/,?\s*Room\s+\d+.*$/i, "")
    .replace(/\s*:\s*\d+.*$/, "")
    .replace(/\s*-\s*\d+\s+\w+\s+(Avenue|Street|Ave|St|Road|Rd|Way|Drive|Dr).*$/i, "")
    // Remove duplicated names (e.g., "Sophia Gordon Hall, Sophia Gordon Hall")
    .split(",")[0]
    .trim();

  return name || locationDetail;
}

/**
 * Check if location indicates a virtual event
 */
function isVirtualLocation(location: string): boolean {
  const virtualKeywords = [
    "zoom",
    "virtual",
    "online",
    "remote",
    "webinar",
    "teams",
    "meet.google",
    "webex",
  ];
  const lower = location.toLowerCase();
  return virtualKeywords.some((keyword) => lower.includes(keyword));
}

// ============================================================================
// Main Script
// ============================================================================

async function run() {
  console.log("=".repeat(60));
  console.log("Re-Geocoding Events Script");
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
    // Step 1: Load POIs for matching
    // -------------------------------------------------------------------------
    console.log("\n[Step 1] Loading POIs from database...");

    const allPOIs = (await sql`
      SELECT id, name, aliases, address, lat, lng FROM points_of_interest
    `) as POI[];

    console.log(`Loaded ${allPOIs.length} POIs`);

    // -------------------------------------------------------------------------
    // Step 2: Fetch all events with location_detail
    // -------------------------------------------------------------------------
    console.log("\n[Step 2] Fetching events from database...");

    const events = (await sql`
      SELECT id, title, location_name, location_detail, address, lat, lng
      FROM events
      WHERE location_detail IS NOT NULL
      ORDER BY created_at DESC
    `) as Event[];

    console.log(`Found ${events.length} events with location_detail`);

    if (events.length === 0) {
      console.log("No events to process!");
      return;
    }

    // -------------------------------------------------------------------------
    // Step 3: Process each event
    // -------------------------------------------------------------------------
    console.log("\n[Step 3] Re-geocoding events...");

    let successCount = 0;
    let poiMatchCount = 0;
    let geocodeCount = 0;
    let virtualCount = 0;
    let failCount = 0;

    // Process in batches to avoid rate limits
    const BATCH_SIZE = 10;
    const DELAY_MS = 100; // 100ms between requests

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const locationDetail = event.location_detail;
      if (locationDetail == null) continue;

      console.log(`\n[${i + 1}/${events.length}] "${event.title}"`);
      console.log(`  Location detail: "${locationDetail}"`);

      // Check for virtual events
      if (isVirtualLocation(locationDetail)) {
        console.log(`  -> Virtual event, skipping geocoding`);
        virtualCount++;
        continue;
      }

      // Try to match with a POI first
      let matchedPOI = findMatchingPOI(locationDetail, null, null, allPOIs);

      if (matchedPOI) {
        console.log(`  -> POI match: "${matchedPOI.name}"`);

        await sql`
          UPDATE events
          SET
            location_name = ${matchedPOI.name},
            address = ${matchedPOI.address},
            lat = ${matchedPOI.lat},
            lng = ${matchedPOI.lng},
            updated_at = NOW()
          WHERE id = ${event.id}
        `;

        successCount++;
        poiMatchCount++;
        continue;
      }

      // No POI match, try geocoding
      const geocodeResult = await geocodeLocation(locationDetail, googleMapsApiKey);

      if (geocodeResult) {
        // Check if geocoded result matches a POI by proximity (only for on-campus results)
        if (!geocodeResult.isOffCampus) {
          matchedPOI = findMatchingPOI(
            locationDetail,
            geocodeResult.lat,
            geocodeResult.lng,
            allPOIs,
          );
        }

        if (matchedPOI) {
          console.log(`  -> Geocoded, matched to POI: "${matchedPOI.name}"`);

          await sql`
            UPDATE events
            SET
              location_name = ${matchedPOI.name},
              address = ${matchedPOI.address || geocodeResult.address},
              lat = ${matchedPOI.lat},
              lng = ${matchedPOI.lng},
              updated_at = NOW()
            WHERE id = ${event.id}
          `;

          successCount++;
          poiMatchCount++;
        } else {
          // Use geocoded result directly
          const locationName = extractLocationName(locationDetail);
          const offCampusNote = geocodeResult.isOffCampus ? " (off-campus)" : "";
          console.log(`  -> Geocoded${offCampusNote}: ${geocodeResult.address}`);

          await sql`
            UPDATE events
            SET
              location_name = ${locationName},
              address = ${geocodeResult.address},
              lat = ${geocodeResult.lat},
              lng = ${geocodeResult.lng},
              updated_at = NOW()
            WHERE id = ${event.id}
          `;

          successCount++;
          geocodeCount++;
        }
      } else {
        console.log(
          `  -> Failed to geocode (not near Tufts and not a recognized off-campus venue)`,
        );
        failCount++;
      }

      // Rate limiting delay
      if (i % BATCH_SIZE === BATCH_SIZE - 1) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    }

    // -------------------------------------------------------------------------
    // Step 4: Summary
    // -------------------------------------------------------------------------
    console.log(`\n${"=".repeat(60)}`);
    console.log("Re-Geocoding Complete!");
    console.log("=".repeat(60));
    console.log(`Total events processed: ${events.length}`);
    console.log(`Successfully updated:   ${successCount}`);
    console.log(`  - POI matches:        ${poiMatchCount}`);
    console.log(`  - Geocoded:           ${geocodeCount}`);
    console.log(`Virtual events:         ${virtualCount}`);
    console.log(`Failed to geocode:      ${failCount}`);
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

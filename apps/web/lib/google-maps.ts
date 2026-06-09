/**
 * Google Maps Geocoding utilities
 * Restricted to Massachusetts/Medford/Tufts area
 */

// Tufts University center coordinates (Medford campus)
export const TUFTS_CENTER = {
  lat: 42.4084,
  lng: -71.1195,
};

// Bounding box for Medford/Somerville/Tufts area
// This restricts geocoding results to this general area
export const MEDFORD_BOUNDS = {
  north: 42.45,
  south: 42.35,
  east: -71.05,
  west: -71.2,
};

export interface GeocodingResult {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat] to match existing interface
  formatted_address: string;
}

export interface ReverseGeocodingResult {
  address: string;
  lat: number;
  lng: number;
}

/**
 * Forward geocode an address using Google Maps Geocoding API
 * Results are biased towards the Medford/Tufts area
 */
export async function forwardGeocode(query: string, apiKey: string): Promise<GeocodingResult[]> {
  if (!query.trim()) {
    return [];
  }

  try {
    // Use bounds to bias results towards Medford/Tufts area
    const bounds = `${MEDFORD_BOUNDS.south},${MEDFORD_BOUNDS.west}|${MEDFORD_BOUNDS.north},${MEDFORD_BOUNDS.east}`;

    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", query);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("bounds", bounds);
    url.searchParams.set("components", "country:US|administrative_area:MA");

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== "OK" || !data.results) {
      return [];
    }

    interface GoogleGeocodingResult {
      place_id?: string;
      formatted_address: string;
      address_components?: Array<{ types: string[]; short_name: string }>;
      geometry: { location: { lat: number; lng: number } };
    }

    // Filter results to only include those in Massachusetts
    const filteredResults = data.results.filter((result: GoogleGeocodingResult) => {
      const addressComponents = result.address_components || [];
      const stateComponent = addressComponents.find((c: { types: string[]; short_name: string }) =>
        c.types.includes("administrative_area_level_1"),
      );
      return stateComponent?.short_name === "MA";
    });

    return filteredResults.slice(0, 5).map((result: GoogleGeocodingResult, index: number) => ({
      id: result.place_id || `result-${index}`,
      place_name: result.formatted_address,
      center: [result.geometry.location.lng, result.geometry.location.lat] as [number, number],
      formatted_address: result.formatted_address,
    }));
  } catch (error) {
    console.error("Forward geocoding error:", error);
    return [];
  }
}

/**
 * Reverse geocode coordinates to an address using Google Maps Geocoding API
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  apiKey: string,
): Promise<string | null> {
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("latlng", `${lat},${lng}`);
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      return null;
    }

    return data.results[0].formatted_address;
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return null;
  }
}

/**
 * Check if coordinates are within the Medford/Tufts area bounds
 */
export function isWithinMedfordBounds(lat: number, lng: number): boolean {
  return (
    lat >= MEDFORD_BOUNDS.south &&
    lat <= MEDFORD_BOUNDS.north &&
    lng >= MEDFORD_BOUNDS.west &&
    lng <= MEDFORD_BOUNDS.east
  );
}

/**
 * Generate a static map URL for preview images
 */
export function getStaticMapUrl(
  lat: number,
  lng: number,
  apiKey: string,
  options: {
    width?: number;
    height?: number;
    zoom?: number;
    markerColor?: string;
  } = {},
): string {
  const { width = 400, height = 200, zoom = 15, markerColor = "0x1736e6" } = options;

  const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
  url.searchParams.set("center", `${lat},${lng}`);
  url.searchParams.set("zoom", zoom.toString());
  url.searchParams.set("size", `${width}x${height}`);
  url.searchParams.set("scale", "2");
  url.searchParams.set("maptype", "roadmap");
  url.searchParams.set("markers", `color:${markerColor}|${lat},${lng}`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("style", "feature:poi|visibility:simplified");

  return url.toString();
}

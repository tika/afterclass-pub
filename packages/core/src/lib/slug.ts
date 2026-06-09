/**
 * Generate a URL-friendly slug from a string.
 * Lowercase, replace spaces/special chars with hyphens, collapse multiple hyphens, trim hyphens.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/[^a-z0-9\s-]/g, "") // strip special characters
    .replace(/[\s]+/g, "-") // replace spaces with hyphens
    .replace(/-{2,}/g, "-") // collapse multiple hyphens
    .replace(/^-|-$/g, ""); // trim leading/trailing hyphens
}

/**
 * Generate a short random ID (nanoid-style) using crypto.getRandomValues.
 * Uses base62 (a-z, A-Z, 0-9) for URL-safe IDs.
 */
export function generatePublicId(length: number = 8): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += alphabet[bytes[i]! % alphabet.length];
  }
  return result;
}

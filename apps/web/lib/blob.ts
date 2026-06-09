/**
 * Valid image file types
 */
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5 MB

/**
 * Validates if a file is a valid image type
 */
function isValidImageType(file: File): boolean {
  return ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number]);
}

/**
 * Uploads an image file to S3 via the API upload route
 * This should be called from a server action or API route for security
 *
 * @param file - The image file to upload
 * @param filename - Optional custom filename (not used, kept for compatibility)
 * @returns The URL of the uploaded file
 * @throws Error if file validation fails or upload fails
 */
export async function uploadImage(file: File, _filename?: string): Promise<string> {
  // Validate file type
  if (!isValidImageType(file)) {
    throw new Error(`Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(", ")}`);
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // Create form data
  const formData = new FormData();
  formData.append("file", file);

  // Call API route for secure upload (uses S3 presigned URLs)
  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: "Failed to upload image",
    }));
    throw new Error(error.error || "Failed to upload image");
  }

  const data = await response.json();
  return data.url;
}

/**
 * Client-side upload helper that calls a server action
 * This is a wrapper that should be used from client components
 * The actual upload will happen via a server action route
 */
export async function uploadImageClient(file: File): Promise<string> {
  // Validate file type
  if (!isValidImageType(file)) {
    throw new Error(`Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(", ")}`);
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // Create form data
  const formData = new FormData();
  formData.append("file", file);

  // Call API route for secure upload
  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: "Failed to upload image",
    }));
    throw new Error(error.error || "Failed to upload image");
  }

  const data = await response.json();
  return data.url;
}

/**
 * Uploads an event flyer image with event-specific naming
 * Uses S3 presigned URLs via the API upload route
 * @param file - The image file to upload
 * @param eventId - Optional event ID for event-specific path
 * @returns The URL of the uploaded file
 */
export async function uploadEventFlyer(file: File, eventId?: string): Promise<string> {
  // Validate file type
  if (!isValidImageType(file)) {
    throw new Error(`Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(", ")}`);
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // Create form data
  const formData = new FormData();
  formData.append("file", file);

  // Build URL with optional eventId query parameter
  const url = eventId ? `/api/upload?eventId=${eventId}` : "/api/upload";

  // Call API route for secure upload
  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: "Failed to upload image",
    }));
    throw new Error(error.error || "Failed to upload image");
  }

  const data = await response.json();
  return data.url;
}

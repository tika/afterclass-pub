import { randomUUID } from "node:crypto";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const bucketName = process.env.BUCKET_NAME;
if (!bucketName) {
  throw new Error("BUCKET_NAME environment variable is required");
}

const region = process.env.AWS_REGION || "us-east-1";

const s3Client = new S3Client({
  region,
});

/**
 * Generate S3 key for group logo
 */
export function getGroupLogoKey(groupId: string, extension: string): string {
  const uuid = randomUUID();
  return `groups/${groupId}/logos/${uuid}.${extension}`;
}

/**
 * Generate S3 key for group banner
 */
export function getGroupBannerKey(groupId: string, extension: string): string {
  const uuid = randomUUID();
  return `groups/${groupId}/banners/${uuid}.${extension}`;
}

/**
 * Generate S3 key for a published event flyer.
 * Files under `events/published/` are publicly readable via bucket policy.
 */
export function getEventFlyerKey(eventId: string, extension: string): string {
  const uuid = randomUUID();
  return `events/published/${eventId}/flyers/${uuid}.${extension}`;
}

/**
 * Generate S3 key for draft event flyer
 */
export function getDraftFlyerKey(extension: string): string {
  const uuid = randomUUID();
  return `events/draft/${uuid}.${extension}`;
}

/**
 * Generate S3 key for flyer submission (auto-uploaded flyers for OCR extraction)
 */
export function getFlyerSubmissionKey(extension: string): string {
  const uuid = randomUUID();
  return `flyer-submissions/${uuid}.${extension}`;
}

/**
 * Get public URL for an S3 key
 */
export function getPublicUrl(key: string): string {
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}

const CACHE_CONTROL = "public, max-age=31536000, immutable";

/**
 * Upload a file directly to S3
 *
 * NOTE: uploadFile should ONLY be used by internal scripts (upsertOrgs.ts, migrations),
 * never by request handlers. For user-initiated uploads, use generatePresignedUploadUrl() instead.
 *
 * @param key - S3 key (path)
 * @param buffer - File buffer
 * @param contentType - MIME type (e.g., "image/jpeg")
 * @returns Public URL of the uploaded file
 */
export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: CACHE_CONTROL,
  });

  await s3Client.send(command);
  return getPublicUrl(key);
}

/**
 * Generate a presigned GET URL for reading a file from S3
 *
 * Used for draft files that are not publicly accessible.
 *
 * @param key - S3 key (path)
 * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns Presigned GET URL
 */
export async function generatePresignedGetUrl(
  key: string,
  expiresIn: number = 3600,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, {
    expiresIn,
  });
}

/**
 * Generate a presigned URL for uploading a file to S3
 *
 * This is the preferred method for user-initiated uploads.
 * The presigned URL includes validation constraints enforced by S3.
 *
 * @param key - S3 key (path)
 * @param contentType - MIME type (must start with "image/")
 * @param maxSizeBytes - Maximum file size in bytes
 * @param expiresIn - URL expiration time in seconds (default: 900 = 15 minutes)
 * @returns Object containing presigned URL, key, and public URL (or presigned GET URL for draft files)
 */
export async function generatePresignedUploadUrl(
  key: string,
  contentType: string,
  _maxSizeBytes: number, // Validated in API endpoint, not used here
  expiresIn: number = 900,
): Promise<{
  presignedUrl: string;
  key: string;
  publicUrl: string;
}> {
  // Validate content type
  if (!contentType.startsWith("image/")) {
    throw new Error(`Invalid content type: ${contentType}. Must start with "image/"`);
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
    CacheControl: CACHE_CONTROL,
  });

  // Generate presigned URL with constraints
  const presignedUrl = await getSignedUrl(s3Client, command, {
    expiresIn,
  });

  // Note: Content-Length validation should be enforced in the API endpoint
  // that calls this function, as presigned URLs don't support Content-Length
  // constraints directly in the policy. The API should validate before generating
  // the presigned URL and include size limits in the request validation.

  // For draft files, generate a presigned GET URL instead of public URL
  // Draft files are not publicly accessible, so we need a presigned URL to view them
  const isDraftFile = key.startsWith("events/draft/");
  const viewUrl = isDraftFile
    ? await generatePresignedGetUrl(key, 3600) // 1 hour expiration for draft previews
    : getPublicUrl(key);

  return {
    presignedUrl,
    key,
    publicUrl: viewUrl,
  };
}

/**
 * Copy a file within S3
 *
 * @param sourceKey - Source S3 key
 * @param destinationKey - Destination S3 key
 * @returns Public URL of the copied file
 */
export async function copyFile(sourceKey: string, destinationKey: string): Promise<string> {
  const command = new CopyObjectCommand({
    Bucket: bucketName,
    CopySource: `${bucketName}/${sourceKey}`,
    Key: destinationKey,
    CacheControl: CACHE_CONTROL,
  });

  await s3Client.send(command);
  return getPublicUrl(destinationKey);
}

/** Prefixes that need promotion to the published path */
const PRIVATE_PREFIXES = ["events/draft/", "flyer-submissions/"];

/**
 * Promote flyer URLs from private staging paths to the permanent public path.
 *
 * Handles files from `events/draft/` and `flyer-submissions/`, copying them
 * to `events/published/{eventId}/flyers/` and deleting the originals.
 * URLs already under `events/published/` are returned as-is.
 *
 * @param eventId - The published event's ID
 * @param flyerUrls - Array of flyer URLs (may include presigned, staging, or already-public URLs)
 * @returns Array of clean public URLs
 */
export async function promoteDraftFlyers(eventId: string, flyerUrls: string[]): Promise<string[]> {
  const publicUrls: string[] = [];

  for (const url of flyerUrls) {
    // Extract the S3 key from the URL (strip query params and bucket prefix)
    const urlPath = new URL(url).pathname.slice(1); // remove leading /

    const isPrivate = PRIVATE_PREFIXES.some((p) => urlPath.startsWith(p));
    if (!isPrivate) {
      // Already a public/permanent URL
      publicUrls.push(getPublicUrl(urlPath));
      continue;
    }

    const ext = urlPath.split(".").pop() || "jpg";
    const newKey = getEventFlyerKey(eventId, ext);

    await copyFile(urlPath, newKey);
    await deleteFile(urlPath);
    publicUrls.push(getPublicUrl(newKey));
  }

  return publicUrls;
}

/**
 * Delete a file from S3
 *
 * @param key - S3 key (path)
 */
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  await s3Client.send(command);
}

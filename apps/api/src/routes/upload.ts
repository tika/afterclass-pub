import { zValidator } from "@/lib/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { events } from "@afterclass/core/db/schema";
import {
  generatePresignedUploadUrl,
  getDraftFlyerKey,
  getEventFlyerKey,
  getGroupBannerKey,
  getGroupLogoKey,
} from "@afterclass/core/lib/s3";
import { isGroupAdmin } from "@afterclass/core/services/groups";
import type { AppVariables } from "@/lib/types";
import { requireAuth } from "@/middleware/requireAuth";

const uploadRouter = new Hono<{
  Variables: AppVariables;
}>();

const presignedUrlSchema = z.object({
  entityType: z.enum(["group", "event"]),
  entityId: z.uuid().optional(), // Required for group/event, not for draft
  assetType: z.enum(["logo", "banner", "flyer"]),
  contentType: z
    .string()
    .refine((val) => val.startsWith("image/"), "Content-Type must start with 'image/'"),
  contentLength: z.number().int().positive(),
});

// Max file sizes (in bytes)
const MAX_GROUP_ASSET_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_EVENT_FLYER_SIZE = 4.5 * 1024 * 1024; // 4.5MB

/**
 * Generate presigned URL for uploading assets to S3
 *
 * POST /upload/presigned-url
 *
 * Body:
 * - entityType: "group" | "event"
 * - entityId: UUID (required for group/event, optional for draft flyers)
 * - assetType: "logo" | "banner" | "flyer"
 * - contentType: MIME type (must start with "image/")
 * - contentLength: File size in bytes
 *
 * Returns:
 * - presignedUrl: URL to upload file directly to S3
 * - key: S3 key (path)
 * - publicUrl: Final public URL after upload
 */
uploadRouter.post(
  "/presigned-url",
  requireAuth,
  zValidator("json", presignedUrlSchema),
  async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const ctx = c.get("services");
    const { entityType, entityId, assetType, contentType, contentLength } = c.req.valid("json");

    // Validate content type
    if (!contentType.startsWith("image/")) {
      return c.json({ error: "Invalid content type. Must start with 'image/'" }, 400);
    }

    // Determine max size based on asset type
    let maxSize: number;
    if (entityType === "group") {
      maxSize = MAX_GROUP_ASSET_SIZE;
    } else {
      maxSize = MAX_EVENT_FLYER_SIZE;
    }

    // Validate file size
    if (contentLength > maxSize) {
      return c.json(
        {
          error: `File size exceeds maximum of ${maxSize / 1024 / 1024}MB`,
          maxSize,
        },
        400,
      );
    }

    // Generate S3 key based on entity type and asset type
    let s3Key: string;
    const extension = contentType.split("/")[1] || "jpg"; // Extract extension from MIME type

    if (entityType === "group") {
      if (!entityId) {
        return c.json({ error: "Group ID is required" }, 400);
      }

      // Check if user is admin of the group
      const isAdmin = await isGroupAdmin(ctx, entityId, user.id);
      if (!isAdmin) {
        return c.json({ error: "Forbidden: Only group admins can upload assets" }, 403);
      }

      if (assetType === "logo") {
        s3Key = getGroupLogoKey(entityId, extension);
      } else if (assetType === "banner") {
        s3Key = getGroupBannerKey(entityId, extension);
      } else {
        return c.json({ error: "Invalid asset type for group. Use 'logo' or 'banner'" }, 400);
      }
    } else {
      // Event
      if (assetType !== "flyer") {
        return c.json({ error: "Invalid asset type for event. Use 'flyer'" }, 400);
      }

      if (entityId) {
        // Check if user is admin of the group that owns the event
        const [event] = await ctx.db.select().from(events).where(eq(events.id, entityId)).limit(1);

        if (!event) {
          return c.json({ error: "Event not found" }, 404);
        }

        const isAdmin = await isGroupAdmin(ctx, event.groupId, user.id);
        if (!isAdmin) {
          return c.json(
            {
              error: "Forbidden: Only group admins can upload event flyers",
            },
            403,
          );
        }

        s3Key = getEventFlyerKey(entityId, extension);
      } else {
        // Draft flyer - no permission check needed, but user must be authenticated
        s3Key = getDraftFlyerKey(extension);
      }
    }

    try {
      // Generate presigned URL
      const result = await generatePresignedUploadUrl(s3Key, contentType, contentLength);

      return c.json({
        success: true,
        presignedUrl: result.presignedUrl,
        key: result.key,
        publicUrl: result.publicUrl,
      });
    } catch (error) {
      console.error("Error generating presigned URL:", error);
      return c.json(
        {
          error: "Failed to generate presigned URL",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  },
);

export default uploadRouter;

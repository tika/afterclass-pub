import { zValidator } from "@/lib/zod-validator";
import { Hono } from "hono";
import { generatePresignedUploadUrl, getFlyerSubmissionKey } from "@afterclass/core/lib/s3";
import type { AppVariables } from "@/lib/types";
import {
  confirmSchema,
  extractSchema,
  presignedUrlSchema,
  processSchema,
} from "@afterclass/core/schemas/flyerSubmissions";
import {
  confirmFlyerSubmission,
  DuplicateEventError,
  extractFlyerSubmission,
  MAX_FLYER_SIZE,
  NotAnEventError,
  processFlyerSubmission,
} from "@afterclass/core/services/flyerSubmissions";

// Chain routes to accumulate types for Hono RPC
const flyerSubmissionsRouter = new Hono<{ Variables: AppVariables }>()
  .post("/presigned-url", zValidator("json", presignedUrlSchema), async (c) => {
    const { contentType, contentLength } = c.req.valid("json");

    if (contentLength > MAX_FLYER_SIZE) {
      return c.json(
        {
          error: `File size exceeds maximum of ${MAX_FLYER_SIZE / 1024 / 1024}MB`,
          maxSize: MAX_FLYER_SIZE,
        },
        400,
      );
    }

    const extension = contentType.split("/")[1] || "jpg";
    const s3Key = getFlyerSubmissionKey(extension);

    try {
      const result = await generatePresignedUploadUrl(s3Key, contentType, contentLength);

      return c.json(
        {
          success: true,
          presignedUrl: result.presignedUrl,
          s3Key: result.key,
          publicUrl: result.publicUrl,
        },
        200,
      );
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
  })
  .post("/process", zValidator("json", processSchema), async (c) => {
    const { s3Key } = c.req.valid("json");
    const ctx = c.get("services");

    try {
      const result = await processFlyerSubmission(ctx, s3Key);

      return c.json(
        {
          success: true,
          submission: {
            id: result.submission.id,
            s3Key: result.submission.s3Key,
            s3Url: result.submission.s3Url,
            status: result.submission.status,
            extractedData: result.submission.extractedData,
            matchedGroupId: result.submission.matchedGroupId,
            matchConfidence: result.submission.matchConfidence,
            eventId: result.submission.eventId,
          },
          extractedData: result.extractedData,
          matchedGroup: result.matchedGroup,
          draftEvent: result.draftEvent,
        },
        200,
      );
    } catch (error) {
      if (error instanceof DuplicateEventError) {
        return c.json(
          {
            error: "duplicate_event",
            message: error.message,
            existingEventId: error.existingEventId,
          },
          409,
        );
      }
      if (error instanceof NotAnEventError) {
        return c.json(
          {
            error: "not_an_event",
            message: error.message,
          },
          400,
        );
      }
      console.error("Error processing flyer submission:", error);
      return c.json(
        {
          error: "Failed to process flyer",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  })
  .post("/extract", zValidator("json", extractSchema), async (c) => {
    const { s3Key } = c.req.valid("json");
    const ctx = c.get("services");

    try {
      const result = await extractFlyerSubmission(ctx, s3Key);

      return c.json(
        {
          success: true,
          submission: {
            id: result.submission.id,
            s3Key: result.submission.s3Key,
            s3Url: result.submission.s3Url,
            status: result.submission.status,
          },
          extractedData: result.extractedData,
          matchedGroup: result.matchedGroup,
        },
        200,
      );
    } catch (error) {
      if (error instanceof NotAnEventError) {
        return c.json(
          {
            error: "not_an_event",
            message: error.message,
          },
          400,
        );
      }
      console.error("Error extracting flyer submission:", error);
      return c.json(
        {
          error: "Failed to extract flyer data",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  })
  .post("/confirm", zValidator("json", confirmSchema), async (c) => {
    const { submissionId, confirmedData } = c.req.valid("json");
    const ctx = c.get("services");

    try {
      const result = await confirmFlyerSubmission(ctx, submissionId, confirmedData);

      return c.json(
        {
          success: true,
          submission: {
            id: result.submission.id,
            s3Key: result.submission.s3Key,
            s3Url: result.submission.s3Url,
            status: result.submission.status,
            matchedGroupId: result.submission.matchedGroupId,
            matchConfidence: result.submission.matchConfidence,
            eventId: result.submission.eventId,
          },
          draftEvent: result.draftEvent,
        },
        201,
      );
    } catch (error) {
      if (error instanceof DuplicateEventError) {
        return c.json(
          {
            error: "duplicate_event",
            message: error.message,
            existingEventId: error.existingEventId,
          },
          409,
        );
      }
      console.error("Error confirming flyer submission:", error);
      return c.json(
        {
          error: "Failed to confirm flyer submission",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  });

export { flyerSubmissionsRouter };

import { z } from "zod";

export const presignedUrlSchema = z.object({
  contentType: z
    .string()
    .refine((val) => val.startsWith("image/"), "Content-Type must start with 'image/'"),
  contentLength: z.number().int().positive(),
});

export const processSchema = z.object({
  s3Key: z
    .string()
    .min(1)
    .refine(
      (val) => val.startsWith("flyer-submissions/"),
      "Invalid s3Key: must be in flyer-submissions/ folder",
    ),
});

export const extractSchema = z.object({
  s3Key: z
    .string()
    .min(1)
    .refine(
      (val) => val.startsWith("flyer-submissions/"),
      "Invalid s3Key: must be in flyer-submissions/ folder",
    ),
});

export const confirmSchema = z.object({
  submissionId: z.string().min(1),
  confirmedData: z.object({
    title: z.string(),
    orgName: z.string(),
    startDate: z.string().nullable(),
    startTime: z.string().nullable(),
    endTime: z.string().nullable(),
    locationName: z.string().nullable(),
    description: z.string().nullable(),
  }),
});

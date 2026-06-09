import { z } from "zod";

export const validateEmailDomainSchema = z.object({
  email: z.email("Invalid email format"),
});

export const completeOnboardingSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  class_of: z.number().int().positive("Class of must be a positive integer"),
  interests: z.array(z.string()), // Allow empty array - interests are optional
  majors: z.array(z.string()).max(3).optional(), // Optional majors field (up to 3)
  notification_mode: z.enum(["simple", "adaptive"]).default("simple"), // Notification preference
});

export const universitySchema = z.object({
  id: z.number(),
  name: z.string(),
  website_url: z.string().nullable(),
  logo_url: z.string().nullable(),
  primary_color: z.string().nullable(),
  secondary_color: z.string().nullable(),
});

export const profileSchema = z.object({
  id: z.number(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  imageUrl: z.string().nullable(),
  bio: z.string().nullable(),
  class_of: z.number().int().nullable(),
  interests: z.array(z.string()).nullable(),
});

export const validateEmailDomainResponseSchema = z.object({
  isValid: z.boolean(),
  domain: z.string(),
  university: universitySchema.nullable(),
});

export const onboardingStatusResponseSchema = z.object({
  needsOnboarding: z.boolean(),
  profile: profileSchema.nullable(),
});

export const completeOnboardingResponseSchema = z.object({
  success: z.boolean(),
  profile: profileSchema,
});

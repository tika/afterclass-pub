import { z } from "zod";

export const createWaitlistSignupSchema = z.object({
  email: z.email("Invalid email address"),
  school: z.string().min(1, "School is required"),
});

export const waitlistSignupResponseSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  school: z.string(),
  createdAt: z.coerce.date(),
});

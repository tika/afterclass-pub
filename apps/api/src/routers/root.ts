import { Hono } from "hono";
import { hc } from "hono/client";
import type { AppVariables } from "@/lib/types";
import { appConfigRouter } from "./appConfig";
import { eventsRouter } from "./events";
import { feedRouter } from "./feed";
import { flyerSubmissionsRouter } from "./flyerSubmissions";
import { groupsRouter } from "./groups";
import { onboardingRouter } from "./onboarding";
import { poisRouter } from "./pois";
import { profileRouter } from "./profile";
import { pushRouter } from "./push";
import { remindersRouter } from "./reminders";
import { statsRouter } from "./stats";
import { waitlistRouter } from "./waitlist";

// Chain all routes to properly accumulate types for Hono RPC
const routes = new Hono<{ Variables: AppVariables }>()
  .route("/app-config", appConfigRouter)
  .route("/push", pushRouter)
  .route("/flyer-submissions", flyerSubmissionsRouter)
  .route("/events", eventsRouter)
  .route("/groups", groupsRouter)
  .route("/profile", profileRouter)
  .route("/feed", feedRouter)
  .route("/onboarding", onboardingRouter)
  .route("/reminders", remindersRouter)
  .route("/stats", statsRouter)
  .route("/pois", poisRouter)
  .route("/waitlist", waitlistRouter);

export const router = routes;
export type AppType = typeof routes;

// Export typed client factory for use in other packages
export const createClient = (baseUrl: string, options?: { headers?: Record<string, string> }) => {
  return hc<typeof routes>(baseUrl, options);
};

export type ApiClient = ReturnType<typeof createClient>;

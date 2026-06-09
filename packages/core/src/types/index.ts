import type { z } from "zod";
import type { eventResponseSchema, eventStatusSchema } from "@afterclass/core/schemas/events";
import type { feedEventSchema, feedResponseSchema } from "@afterclass/core/schemas/feed";
import type {
  groupDetailResponseSchema,
  groupMemberResponseSchema,
  groupResponseSchema,
} from "@afterclass/core/schemas/groups";
import type {
  completeOnboardingResponseSchema,
  onboardingStatusResponseSchema,
  validateEmailDomainResponseSchema,
} from "@afterclass/core/schemas/onboarding";
import type { poiResponseSchema } from "@afterclass/core/schemas/pois";
import type { profileResponseSchema } from "@afterclass/core/schemas/profile";
import type { waitlistSignupResponseSchema } from "@afterclass/core/schemas/waitlist";

// ============================================================================
// Entity Types (what mobile receives as JSON)
// ============================================================================

export type Event = z.infer<typeof eventResponseSchema>;
export type Group = z.infer<typeof groupResponseSchema>;
export type FeedEvent = z.infer<typeof feedEventSchema>;
export type User = z.infer<typeof profileResponseSchema>; // Profile response is the User type
export type POI = z.infer<typeof poiResponseSchema>;
export type WaitlistSignup = z.infer<typeof waitlistSignupResponseSchema>;
export type GroupMember = z.infer<typeof groupMemberResponseSchema>;

// Mobile-friendly aliases (for backward compatibility)
export type Organization = Group;
export type EventResponse = Event; // Keep EventResponse alias for compatibility

// ============================================================================
// Response Wrapper Types
// ============================================================================

export type OnboardingStatusResponse = z.infer<typeof onboardingStatusResponseSchema>;
export type ValidateEmailDomainResponse = z.infer<typeof validateEmailDomainResponseSchema>;
export type CompleteOnboardingResponse = z.infer<typeof completeOnboardingResponseSchema>;

export type FeedResponse = z.infer<typeof feedResponseSchema>;

export type GroupDetailResponse = z.infer<typeof groupDetailResponseSchema>;

export type ProfileResponse = z.infer<typeof profileResponseSchema>;

// Response wrapper types for list endpoints (what backend actually returns)
export interface GetGroupsResponse {
  groups: Group[];
  limit: number;
  offset: number;
}

export interface GetEventsResponse {
  events: Array<{
    event: Event;
    group: Group | null;
  }>;
  limit: number;
  offset: number;
}

// ============================================================================
// Enums and Constants
// ============================================================================

export type EventStatus = z.infer<typeof eventStatusSchema>;
export type MediaType = "IMAGE" | "VIDEO";
export type GroupMemberRole = "ADMIN" | "MEMBER";

// ============================================================================
// Utility Types
// ============================================================================

export interface Point {
  x: number; // longitude
  y: number; // latitude
}

export interface BoundingBox {
  points: Point[]; // Array of points forming the polygon boundary
}

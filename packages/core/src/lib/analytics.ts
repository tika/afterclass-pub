import { PostHog } from "posthog-node";

// ---------------------------------------------------------------------------
// Event Catalog
// ---------------------------------------------------------------------------
// Every PostHog event in the app is defined here. To add a new event:
//   1. Add it to `EventCatalog` with its required properties.
//   2. Call `analytics.track(userId, "event_name", { ... })` — TypeScript
//      will enforce the property shape.
// ---------------------------------------------------------------------------

type NotificationTrigger = "discovery" | "following" | "reminder";

type EventCatalog = {
  // ── Notifications ────────────────────────────────────────────────────
  notification_sent: {
    trigger: NotificationTrigger;
    eventId: string;
    eventTitle: string;
    groupId?: string;
    groupName?: string;
    similarityScore?: number;
    notificationId?: string;
  };

  notification_skipped: {
    trigger: NotificationTrigger;
    reason: string;
    userId?: string;
  };

  // ── Schedule ─────────────────────────────────────────────────────────
  discovery_schedule_generated: {
    userCount: number;
    slotsCreated: number;
  };

  // ── Add new events below ─────────────────────────────────────────────
  // example_event: { requiredProp: string; optionalProp?: number };
};

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (client) return client;

  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) return null;

  client = new PostHog(apiKey, {
    host: process.env.POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 20,
    flushInterval: 10_000,
  });

  return client;
}

/**
 * Type-safe event tracking. The event name and properties are validated
 * against the `EventCatalog` at compile time.
 */
function track<E extends keyof EventCatalog>(
  userId: string,
  event: E,
  properties: EventCatalog[E],
): void {
  const ph = getClient();
  if (!ph) return;

  ph.capture({ distinctId: userId, event, properties });
}

async function flush(): Promise<void> {
  const ph = getClient();
  if (!ph) return;
  await ph.flush();
}

export const analytics = { track, flush };

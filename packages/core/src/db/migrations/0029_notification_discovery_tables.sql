-- Notification trigger type enum
DO $$ BEGIN
  CREATE TYPE "notification_trigger" AS ENUM ('saved', 'following', 'discovery');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Discovery schedule status enum
DO $$ BEGIN
  CREATE TYPE "discovery_schedule_status" AS ENUM ('pending', 'sent', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Notification log: idempotency & dedup for all push notification types
CREATE TABLE IF NOT EXISTS "notification_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "trigger" "notification_trigger" NOT NULL,
  "sent_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_log_user_event_trigger_unique"
  ON "notification_log" ("user_id", "event_id", "trigger");

-- Index for fast lookups by user (used by recommender to exclude already-notified events)
CREATE INDEX IF NOT EXISTS "notification_log_user_id_idx"
  ON "notification_log" ("user_id");

-- Discovery schedule: 2 random send slots per user per week
CREATE TABLE IF NOT EXISTS "discovery_schedule" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "send_at" timestamp NOT NULL,
  "status" "discovery_schedule_status" DEFAULT 'pending' NOT NULL,
  "event_id" uuid REFERENCES "events"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Index for the poller: find pending slots that are due
CREATE INDEX IF NOT EXISTS "discovery_schedule_pending_send_at_idx"
  ON "discovery_schedule" ("send_at")
  WHERE "status" = 'pending';

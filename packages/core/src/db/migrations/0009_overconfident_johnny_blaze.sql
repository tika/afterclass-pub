CREATE TYPE "public"."notification_mode" AS ENUM('simple', 'adaptive');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('scheduled', 'sent', 'cancelled');--> statement-breakpoint
CREATE TABLE "scheduled_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"send_at" timestamp NOT NULL,
	"type" text DEFAULT 'event_reminder' NOT NULL,
	"status" "notification_status" DEFAULT 'scheduled' NOT NULL,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_reminders" ADD COLUMN "mode" "notification_mode" DEFAULT 'simple' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notification_mode" "notification_mode" DEFAULT 'simple' NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;

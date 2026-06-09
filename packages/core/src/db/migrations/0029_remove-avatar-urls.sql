CREATE TYPE "public"."discovery_schedule_status" AS ENUM('pending', 'sent', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."notification_trigger" AS ENUM('saved', 'following', 'discovery');--> statement-breakpoint
CREATE TABLE "discovery_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"send_at" timestamp NOT NULL,
	"status" "discovery_schedule_status" DEFAULT 'pending' NOT NULL,
	"event_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"trigger" "notification_trigger" NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_log_user_event_trigger_unique" UNIQUE("user_id","event_id","trigger")
);
--> statement-breakpoint
ALTER TABLE "discovery_schedule" ADD CONSTRAINT "discovery_schedule_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_schedule" ADD CONSTRAINT "discovery_schedule_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "avatar_url";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "image";
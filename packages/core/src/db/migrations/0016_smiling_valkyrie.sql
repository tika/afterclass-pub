CREATE TABLE "flyer_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"s3_key" text NOT NULL,
	"s3_url" text NOT NULL,
	"extracted_data" jsonb,
	"matched_group_id" uuid,
	"match_confidence" double precision,
	"event_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "flyer_submissions" ADD CONSTRAINT "flyer_submissions_matched_group_id_groups_id_fk" FOREIGN KEY ("matched_group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flyer_submissions" ADD CONSTRAINT "flyer_submissions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;
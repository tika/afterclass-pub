ALTER TABLE "events" DROP CONSTRAINT "events_group_id_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "flyer_submissions" DROP CONSTRAINT "flyer_submissions_matched_group_id_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "flyer_submissions" DROP CONSTRAINT "flyer_submissions_event_id_events_id_fk";
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flyer_submissions" ADD CONSTRAINT "flyer_submissions_matched_group_id_groups_id_fk" FOREIGN KEY ("matched_group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flyer_submissions" ADD CONSTRAINT "flyer_submissions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
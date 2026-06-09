ALTER TABLE "points_of_interest" DROP CONSTRAINT "points_of_interest_group_id_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "flyer_aspect_ratio" text;--> statement-breakpoint
ALTER TABLE "points_of_interest" DROP COLUMN "group_id";
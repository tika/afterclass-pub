ALTER TABLE "events" ADD COLUMN "location_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "location_detail" text;--> statement-breakpoint
ALTER TABLE "points_of_interest" ADD COLUMN "aliases" text[];--> statement-breakpoint
ALTER TABLE "points_of_interest" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "points_of_interest" DROP COLUMN "category";
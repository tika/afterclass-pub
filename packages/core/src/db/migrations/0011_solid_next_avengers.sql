ALTER TABLE "event_media" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "event_media" CASCADE;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "flyer_images" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "flyer_aspect_ratio";--> statement-breakpoint
ALTER TABLE "groups" DROP COLUMN "banner_url";--> statement-breakpoint
ALTER TABLE "points_of_interest" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "points_of_interest" DROP COLUMN "category";
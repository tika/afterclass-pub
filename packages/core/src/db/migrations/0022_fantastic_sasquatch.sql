ALTER TABLE "events" ADD COLUMN "public_id" text;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_public_id_unique" UNIQUE("public_id");--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_slug_unique" UNIQUE("slug");
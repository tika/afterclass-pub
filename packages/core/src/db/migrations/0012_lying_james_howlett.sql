CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"lat" double precision,
	"lng" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_tags" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tags" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "event_tags" CASCADE;--> statement-breakpoint
DROP TABLE "tags" CASCADE;--> statement-breakpoint
ALTER TABLE "groups" DROP CONSTRAINT "groups_handle_unique";--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT "events_group_id_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "banner_url" text;--> statement-breakpoint
ALTER TABLE "points_of_interest" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "points_of_interest" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" DROP COLUMN "handle";--> statement-breakpoint
ALTER TABLE "groups" DROP COLUMN "group_type";--> statement-breakpoint
DROP TYPE "public"."group_type";--> statement-breakpoint
DROP TYPE "public"."media_type";
-- Create group_type enum
CREATE TYPE "public"."group_type" AS ENUM('OFFICIAL', 'COMMUNITY');--> statement-breakpoint

-- Create group_member_role enum
CREATE TYPE "public"."group_member_role" AS ENUM('ADMIN', 'MEMBER');--> statement-breakpoint

-- Rename organizations table to groups
ALTER TABLE "public"."organizations" RENAME TO "groups";--> statement-breakpoint

-- Rename slug column to handle
ALTER TABLE "public"."groups" RENAME COLUMN "slug" TO "handle";--> statement-breakpoint

-- Drop is_official column
ALTER TABLE "public"."groups" DROP COLUMN "is_official";--> statement-breakpoint

-- Add group_type column (set default to 'COMMUNITY' for existing rows)
ALTER TABLE "public"."groups" ADD COLUMN "group_type" "public"."group_type" NOT NULL DEFAULT 'COMMUNITY';--> statement-breakpoint

-- Remove default after setting values (optional, but cleaner)
ALTER TABLE "public"."groups" ALTER COLUMN "group_type" DROP DEFAULT;--> statement-breakpoint

-- Create group_members table
CREATE TABLE "public"."group_members" (
	"user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"role" "public"."group_member_role" DEFAULT 'MEMBER' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "group_members_user_id_group_id_pk" PRIMARY KEY("user_id","group_id")
);--> statement-breakpoint

-- Rename organization_follows table to group_follows
ALTER TABLE "public"."organization_follows" RENAME TO "group_follows";--> statement-breakpoint

-- Rename org_id column to group_id in group_follows
ALTER TABLE "public"."group_follows" RENAME COLUMN "org_id" TO "group_id";--> statement-breakpoint

-- Rename org_id column to group_id in events
ALTER TABLE "public"."events" RENAME COLUMN "org_id" TO "group_id";--> statement-breakpoint

-- Drop old foreign key constraints
ALTER TABLE "public"."events" DROP CONSTRAINT "events_org_id_organizations_id_fk";--> statement-breakpoint
ALTER TABLE "public"."group_follows" DROP CONSTRAINT "organization_follows_org_id_organizations_id_fk";--> statement-breakpoint
ALTER TABLE "public"."group_follows" DROP CONSTRAINT "organization_follows_user_id_users_id_fk";--> statement-breakpoint

-- Add new foreign key constraints
ALTER TABLE "public"."events" ADD CONSTRAINT "events_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public"."group_follows" ADD CONSTRAINT "group_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public"."group_follows" ADD CONSTRAINT "group_follows_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public"."group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public"."group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;


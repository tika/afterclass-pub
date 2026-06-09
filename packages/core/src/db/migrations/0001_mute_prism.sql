CREATE TYPE "public"."group_member_role" AS ENUM('ADMIN', 'MEMBER');--> statement-breakpoint
CREATE TYPE "public"."group_type" AS ENUM('OFFICIAL', 'COMMUNITY');--> statement-breakpoint
CREATE TABLE "group_members" (
	"user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"role" "group_member_role" DEFAULT 'MEMBER' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "group_members_user_id_group_id_pk" PRIMARY KEY("user_id","group_id")
);
--> statement-breakpoint
ALTER TABLE "organization_follows" RENAME TO "group_follows";--> statement-breakpoint
ALTER TABLE "organizations" RENAME TO "groups";--> statement-breakpoint
ALTER TABLE "events" RENAME COLUMN "org_id" TO "group_id";--> statement-breakpoint
ALTER TABLE "group_follows" RENAME COLUMN "org_id" TO "group_id";--> statement-breakpoint
ALTER TABLE "groups" RENAME COLUMN "slug" TO "handle";--> statement-breakpoint
ALTER TABLE "groups" RENAME COLUMN "is_official" TO "group_type";--> statement-breakpoint
ALTER TABLE "groups" DROP CONSTRAINT "organizations_slug_unique";--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT "events_org_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "group_follows" DROP CONSTRAINT "organization_follows_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "group_follows" DROP CONSTRAINT "organization_follows_org_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "group_follows" DROP CONSTRAINT "organization_follows_user_id_org_id_pk";--> statement-breakpoint
ALTER TABLE "group_follows" ADD CONSTRAINT "group_follows_user_id_group_id_pk" PRIMARY KEY("user_id","group_id");--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_follows" ADD CONSTRAINT "group_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_follows" ADD CONSTRAINT "group_follows_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_handle_unique" UNIQUE("handle");

CREATE TABLE "app_config" (
	"id" text PRIMARY KEY NOT NULL,
	"ios_latest_version" text NOT NULL,
	"ios_minimum_version" text NOT NULL,
	"ios_app_store_url" text NOT NULL,
	"announcement_enabled" boolean DEFAULT false,
	"announcement_title" text,
	"announcement_message" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "device_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "app_config" ("id", "ios_latest_version", "ios_minimum_version", "ios_app_store_url") VALUES ('default', '1.0.0', '1.0.0', 'https://apps.apple.com/app/idXXXXXXXX');--> statement-breakpoint
ALTER TABLE "event_reminders" DROP COLUMN "mode";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "notification_mode";--> statement-breakpoint
DROP TYPE "public"."notification_mode";
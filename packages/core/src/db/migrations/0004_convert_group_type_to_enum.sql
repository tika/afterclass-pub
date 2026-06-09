-- Create group_type enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE "public"."group_type" AS ENUM('OFFICIAL', 'COMMUNITY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- Add a temporary column with the enum type
ALTER TABLE "public"."groups" ADD COLUMN "group_type_enum" "public"."group_type";--> statement-breakpoint

-- Convert boolean values to enum values (false -> 'COMMUNITY', true -> 'OFFICIAL')
UPDATE "public"."groups" SET "group_type_enum" = CASE
    WHEN "group_type" = true THEN 'OFFICIAL'::"public"."group_type"
    WHEN "group_type" = false THEN 'COMMUNITY'::"public"."group_type"
    ELSE 'COMMUNITY'::"public"."group_type"
END;--> statement-breakpoint

-- Drop the old boolean column
ALTER TABLE "public"."groups" DROP COLUMN "group_type";--> statement-breakpoint

-- Rename the new column to group_type
ALTER TABLE "public"."groups" RENAME COLUMN "group_type_enum" TO "group_type";--> statement-breakpoint

-- Make it NOT NULL
ALTER TABLE "public"."groups" ALTER COLUMN "group_type" SET NOT NULL;


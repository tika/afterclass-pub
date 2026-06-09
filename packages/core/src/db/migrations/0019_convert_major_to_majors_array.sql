-- Convert single major field to majors array (up to 3 majors)
-- Idempotent: handles case where "majors" already exists (e.g., from 0018_pink_wolf_cub rename)
DO $$
BEGIN
  -- Case 1: "major" column exists - convert to majors array
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'major') THEN
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "majors" text[];
    UPDATE "users" SET "majors" = ARRAY["major"] WHERE "major" IS NOT NULL;
    ALTER TABLE "users" DROP COLUMN "major";
  -- Case 2: "majors" exists as text (from rename) - convert to text array
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'majors' AND data_type IN ('text', 'character varying')) THEN
    ALTER TABLE "users" ADD COLUMN "majors_new" text[];
    UPDATE "users" SET "majors_new" = ARRAY[TRIM("majors")] WHERE "majors" IS NOT NULL AND TRIM("majors") != '';
    ALTER TABLE "users" DROP COLUMN "majors";
    ALTER TABLE "users" RENAME COLUMN "majors_new" TO "majors";
  -- Case 3: "majors" already exists as text[] - nothing to do
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'majors') THEN
    NULL; -- Already migrated
  END IF;
END $$;

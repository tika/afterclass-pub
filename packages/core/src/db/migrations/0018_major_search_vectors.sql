-- Add full-text search vectors for "My Major" semantic filtering
-- Generated tsvector column on events (title + description)
ALTER TABLE "events"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce("title", '') || ' ' || coalesce("description", '')
    )
  ) STORED;

CREATE INDEX "idx_events_search_vector" ON "events" USING GIN ("search_vector");

-- Generated tsvector column on groups (name + bio)
ALTER TABLE "groups"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce("name", '') || ' ' || coalesce("bio", '')
    )
  ) STORED;

CREATE INDEX "idx_groups_search_vector" ON "groups" USING GIN ("search_vector");

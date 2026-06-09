-- Migrate Drizzle migration history from `drizzle` schema to `orm` schema.
-- Run this against your database before using drizzle.config with migrations.schema: "orm".

CREATE SCHEMA IF NOT EXISTS orm;

CREATE TABLE IF NOT EXISTS orm.__drizzle_migrations (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);

INSERT INTO orm.__drizzle_migrations (hash, created_at)
SELECT hash, created_at
FROM drizzle.__drizzle_migrations
WHERE NOT EXISTS (
  SELECT 1 FROM orm.__drizzle_migrations o
  WHERE o.hash = drizzle.__drizzle_migrations.hash
);

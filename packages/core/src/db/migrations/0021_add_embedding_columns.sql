-- Ensure pgvector extension exists (required before using vector type)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding columns for semantic search (OpenAI text-embedding-3-small: 1536 dimensions)
ALTER TABLE "groups" ADD COLUMN "embedding" vector(1536);
ALTER TABLE "events" ADD COLUMN "embedding" vector(1536);

-- HNSW indexes for fast cosine similarity search
CREATE INDEX "idx_groups_embedding" ON "groups" USING hnsw (embedding vector_cosine_ops);
CREATE INDEX "idx_events_embedding" ON "events" USING hnsw (embedding vector_cosine_ops);

import OpenAI from "openai";
import type { ServiceContext } from "./context";

const EMBEDDING_MODEL = "text-embedding-3-small";

export type GetOrCreateEmbeddingOptions = {
  cacheKey?: string;
  ttlSeconds?: number;
};

/**
 * Get embedding from Redis cache or generate via OpenAI and cache.
 * Use cacheKey for deterministic keys (e.g. embedding:interest:Sports, embedding:user:{id}:majors).
 */
export async function getOrCreateEmbedding(
  ctx: ServiceContext,
  text: string,
  options?: GetOrCreateEmbeddingOptions,
): Promise<number[]> {
  const { cacheKey, ttlSeconds = 60 * 60 * 24 } = options ?? {};
  const input = text.replaceAll("\n", " ").trim();
  if (!input) {
    throw new Error("Cannot generate embedding for empty text");
  }

  const key = cacheKey ?? `embedding:text:${hashString(input)}`;

  try {
    const cached = await ctx.redis.get<string>(key);
    if (cached) {
      return JSON.parse(cached) as number[];
    }
  } catch {
    // Redis unavailable — proceed to OpenAI
  }

  const embedding = await generateEmbedding(ctx, input);

  try {
    await ctx.redis.set(key, JSON.stringify(embedding), { ex: ttlSeconds });
  } catch {
    // Non-fatal — next request will regenerate
  }

  return embedding;
}

/**
 * Deterministic hash of a string for use in Redis cache keys.
 * Same input always produces the same short key (e.g. "Computer Science" -> "1k2m3n").
 * Used when no explicit cacheKey is passed to getOrCreateEmbedding.
 */
function hashString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h = h >>> 0; // unsigned 32-bit
  }
  return Math.abs(h).toString(36);
}

export async function generateEmbedding(ctx: ServiceContext, text: string): Promise<number[]> {
  const apiKey = ctx.secrets.openaiApiKey;

  const client = new OpenAI({ apiKey });
  const input = text.replaceAll("\n", " ").trim();
  if (!input) {
    throw new Error("Cannot generate embedding for empty text");
  }

  const { data } = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input,
  });

  return data[0].embedding;
}

export function getGroupEmbeddingText(group: {
  name: string;
  bio?: string | null;
  categories?: string[] | null;
}): string {
  const parts: string[] = [group.name];
  if (group.bio) parts.push(group.bio);
  if (group.categories?.length) parts.push(group.categories.join(" "));
  return parts.join(" ");
}

export function getEventEmbeddingText(event: {
  title: string;
  description?: string | null;
}): string {
  const parts: string[] = [event.title];
  if (event.description) parts.push(event.description);
  return parts.join(" ");
}

export async function generateGroupEmbedding(
  ctx: ServiceContext,
  group: { name: string; bio?: string | null; categories?: string[] | null },
): Promise<number[]> {
  const text = getGroupEmbeddingText(group);
  return generateEmbedding(ctx, text);
}

export async function generateEventEmbedding(
  ctx: ServiceContext,
  event: { title: string; description?: string | null },
): Promise<number[]> {
  const text = getEventEmbeddingText(event);
  return generateEmbedding(ctx, text);
}

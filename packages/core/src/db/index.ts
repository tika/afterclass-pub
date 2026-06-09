import { Redis } from "@upstash/redis";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { getSecrets } from "../lib/secrets";

export type Services = {
  db: ReturnType<typeof drizzle<typeof schema>>;
  secrets: Awaited<ReturnType<typeof getSecrets>>;
  redis: Redis;
};

/** Context passed to every service function */
export type ServiceContext = {
  db: Services["db"];
  secrets: Services["secrets"];
  redis: Services["redis"];
};

// Singleton service context - reused across all requests
let serviceContextInstance: ServiceContext | null = null;

/** Get the shared ServiceContext singleton. Creates it on first call. */
export async function createServiceContext(): Promise<ServiceContext> {
  if (!serviceContextInstance) {
    const secrets = await getSecrets();
    serviceContextInstance = {
      db: drizzle(postgres(secrets.databaseRuntimeUrl), { schema }),
      secrets,
      redis: new Redis({
        url: secrets.upstashRedisUrl,
        token: secrets.upstashRedisToken,
      }),
    };
  }
  return serviceContextInstance;
}

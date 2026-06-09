import { resolve } from "node:path";
import { config } from "dotenv";

// Load .env first, then .env.local (overrides) for local dev - must run before any app imports
const cwd = process.cwd();
config({ path: resolve(cwd, ".env") });
config({ path: resolve(cwd, ".env.local"), override: true });

const { serve } = await import("@hono/node-server");
const { default: app } = await import("@/index");

serve({ fetch: app.fetch, port: 8000 });
console.log("Server running on http://localhost:8000");

const shutdown = async () => {
  const { logger } = await import("@afterclass/core/lib/logger");
  const { Sentry } = await import("@/lib/sentry");
  await Promise.all([logger.flush(), Sentry.flush(2000)]);
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

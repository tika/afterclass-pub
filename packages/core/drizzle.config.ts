import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

// OWNER URL: ONLY for migrations (DDL). NEVER for studio, generate, check, or app.
const isMigrate = process.argv.includes("migrate");
const url = (() => {
  if (isMigrate) {
    const owner = process.env.DATABASE_OWNER_URL;
    if (!owner) {
      throw new Error(
        "DATABASE_OWNER_URL is required for migrations. Never use runtime credentials for DDL.",
      );
    }
    return owner;
  }
  return process.env.DATABASE_RUNTIME_URL || process.env.DATABASE_URL || "";
})();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  schemaFilter: ["public"],
  tablesFilter: ["!spatial_ref_sys", "!geography_columns", "!geometry_columns"],
  migrations: {
    schema: "orm",
  },
});

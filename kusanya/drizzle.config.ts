import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config — Kusanya.
 *
 * Migrations are GENERATED here (offline, from schema) and APPLIED at runtime
 * by lib/db/migrate.ts, which supports both drivers:
 *  - PGlite (default local dev + Demo Mode, data dir ./data/pglite)
 *  - postgres-js (any DATABASE_URL: Neon serverless, local Postgres)
 *
 * `drizzle-kit generate` after every schema change; commit the SQL.
 */
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  strict: true,
  verbose: true,
});

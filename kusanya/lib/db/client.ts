import "server-only";
import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { env } from "@/lib/config/env";
import * as schema from "./schema";

/**
 * Dual-driver DB client (build.md §2/§15):
 *  - DATABASE_URL set  → postgres-js (Neon pooled / any Postgres)
 *  - otherwise         → embedded PGlite at ./data/pglite (dev + Demo Mode)
 *
 * Singleton via globalThis so Next.js HMR never opens a second PGlite
 * connection (PGlite is single-connection by design). Both driver packages
 * are listed in next.config.ts `serverExternalPackages` (native/WASM assets).
 */

export type Db =
  | PgliteDatabase<typeof schema>
  | PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  _kusanyaDb?: Db;
};

function createDb(): Db {
  if (env.DATABASE_URL) {
    const client = postgres(env.DATABASE_URL, { max: 10 });
    return drizzlePg(client, { schema });
  }
  const dataDir =
    process.env.PGLITE_DATA_DIR ??
    (env.IS_TEST ? undefined : "./data/pglite"); // undefined → in-memory (tests)
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  return drizzlePglite(new PGlite(dataDir), { schema });
}

export const db: Db = globalForDb._kusanyaDb ?? createDb();
if (!globalForDb._kusanyaDb) globalForDb._kusanyaDb = db;

export function isPgliteDb(target: Db = db): boolean {
  // postgres-js drizzle sessions expose the callable postgres client.
  const session = (target as { session?: { client?: unknown } }).session;
  return typeof session?.client !== "function";
}

/** Ensure schema exists (dev/demo convenience; prod runs scripts/migrate.ts). */
export async function ensureSchema(): Promise<void> {
  const { migrate } = await import("./migrate");
  await migrate(db);
}

/**
 * IDOR guard (security checklist §12): every business-scoped query goes
 * through this — session business id must match the row's business id.
 */
export function assertBusinessScope(
  sessionBusinessId: string,
  rowBusinessId: string,
): void {
  if (sessionBusinessId !== rowBusinessId) {
    throw new Error("forbidden: business scope mismatch");
  }
}

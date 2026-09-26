import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { isPgliteDb, type Db } from "./client";
import * as schema from "./schema";

/**
 * Runtime migrator — applies ./drizzle SQL to whichever driver is active.
 * Called from scripts/migrate.ts (CLI) and by ensureSchema() in dev/demo.
 */
export async function migrate(db: Db): Promise<void> {
  const folder = { migrationsFolder: "./drizzle" };
  if (isPgliteDb(db)) {
    await migratePglite(db as PgliteDatabase<typeof schema>, folder);
  } else {
    await migratePg(db as PostgresJsDatabase<typeof schema>, folder);
  }
}

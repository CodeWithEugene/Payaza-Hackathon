/**
 * CLI migration runner: pnpm db:migrate
 * Applies ./drizzle SQL to PGlite (default) or DATABASE_URL Postgres.
 */
import { ensureSchema } from "@/lib/db/client";

async function main() {
  console.log("▶ applying migrations…");
  await ensureSchema();
  console.log("✔ schema up to date");
  process.exit(0);
}

main().catch((err) => {
  console.error("✖ migration failed:", err);
  process.exit(1);
});

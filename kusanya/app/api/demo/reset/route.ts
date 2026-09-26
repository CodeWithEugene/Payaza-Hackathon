import { env } from "@/lib/config/env";
import { resetDemo, DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demo/seed";
import { routeSession, err, handle } from "@/lib/api/http";

/** POST /api/demo/reset — Demo Mode only: wipe + reseed the FreshLeaf story. */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!env.DEMO_MODE) return err(404, "Not found");
  // Bootstrap a fresh deployment: apply migrations BEFORE the user-count
  // auth probe, so an empty production Postgres is seedable with one POST
  // (the probe itself would throw "relation users does not exist" otherwise).
  // Idempotent — drizzle's migrator no-ops when the journal is applied.
  const { ensureSchema } = await import("@/lib/db/client");
  await ensureSchema();
  const session = await routeSession(req).catch(() => null);
  // Allow unauthenticated reset ONLY when no session exists yet (fresh clone);
  // otherwise require the signed-in demo user.
  if (session === null) {
    const hasAny = await import("@/lib/db/client").then(async ({ db }) => {
      const { users } = await import("@/lib/db/schema");
      const { sql } = await import("drizzle-orm");
      const rows = await db.select({ n: sql<number>`count(*)` }).from(users);
      return Number(rows[0]?.n ?? 0) > 0;
    });
    if (hasAny) return err(401, "Sign in to reset the demo.");
  }
  return handle(async () => {
    const result = await resetDemo();
    return { ok: true, login: { email: DEMO_EMAIL, password: DEMO_PASSWORD }, ...result };
  });
}

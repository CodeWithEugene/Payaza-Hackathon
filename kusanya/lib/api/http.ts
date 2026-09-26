import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { businesses } from "@/lib/db/schema";
import { db } from "@/lib/db/client";
import { eq } from "drizzle-orm";

/** Shared route-handler helpers: session, scoping, error → JSON mapping. */

export interface RouteSession {
  userId: string;
  businessId: string;
  userName: string | null;
}

/** Require session + business, or null (caller returns 401/403 JSON). */
export async function routeSession(req: Request): Promise<RouteSession | null> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return null;
  const rows = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.userId, session.user.id))
    .limit(1);
  if (!rows[0]) return null;
  return {
    userId: session.user.id,
    businessId: rows[0].id,
    userName: session.user.name,
  };
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function err(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Wrap a handler body: known user errors → 400 with the message (persona
 * copy), everything else → 500 with a generic message + server log.
 */
export async function handle<T>(
  fn: () => Promise<T>,
): Promise<NextResponse> {
  try {
    const data = await fn();
    return json(data ?? { ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const known =
      /not found|not sendable|cannot|must be|Enter a valid|Invoice is in|no default|No active|frozen|blocked|Wrong confirmation|unsupported|sum to|missing|reject/i.test(msg);
    if (known) return err(400, msg);
    console.error("[api] unhandled:", e);
    return err(500, "Something went wrong on our side. The team has been alerted.");
  }
}

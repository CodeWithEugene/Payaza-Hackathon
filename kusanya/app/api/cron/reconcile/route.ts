import { env } from "@/lib/config/env";
import { reconcilePendingCollections } from "@/lib/services/collections";
import { reconcilePendingPayouts } from "@/lib/services/payouts";

/**
 * GET /api/cron/reconcile — every 5 min (vercel.json). Polls PENDING
 * collections + payouts so nothing waits on a lost webhook. Protected by
 * CRON_SECRET in production; open on localhost dev.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (env.CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${env.CRON_SECRET}`) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const collections = await reconcilePendingCollections();
  const payouts = await reconcilePendingPayouts();
  return Response.json({ ok: true, collections, payouts });
}

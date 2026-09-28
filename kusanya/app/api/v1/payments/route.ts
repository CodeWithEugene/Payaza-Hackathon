import { apiRoute, parseQuery } from "@/lib/api/v1/handler";
import { listPaymentsQuerySchema } from "@/lib/api/v1/schemas";
import { ok } from "@/lib/api/v1/envelope";
import { apiListPayments } from "@/lib/services/api-v1";

/** GET /api/v1/payments — the transactions ledger (collections, payouts, …). */
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (ctx) => {
  const query = parseQuery(ctx.req, listPaymentsQuerySchema);
  const { data, pagination } = await apiListPayments(ctx, query);
  return ok(data, { pagination });
});

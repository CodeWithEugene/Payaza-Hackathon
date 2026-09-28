import { apiRoute, parseQuery } from "@/lib/api/v1/handler";
import { listBuyersQuerySchema } from "@/lib/api/v1/schemas";
import { ok } from "@/lib/api/v1/envelope";
import { apiListBuyers } from "@/lib/services/api-v1";

/** GET /api/v1/buyers — the business's buyer directory. */
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (ctx) => {
  const query = parseQuery(ctx.req, listBuyersQuerySchema);
  const { data, pagination } = await apiListBuyers(ctx, query);
  return ok(data, { pagination });
});

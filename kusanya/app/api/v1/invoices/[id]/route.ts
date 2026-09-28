import { apiRoute } from "@/lib/api/v1/handler";
import { ok } from "@/lib/api/v1/envelope";
import { apiGetInvoice } from "@/lib/services/api-v1";

/** GET /api/v1/invoices/{id} — invoice with line items and payments. */
export const dynamic = "force-dynamic";

export const GET = apiRoute<{ id: string }>(async (ctx, { id }) => {
  return ok(await apiGetInvoice(ctx, id));
});

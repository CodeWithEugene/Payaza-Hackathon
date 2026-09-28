import { apiRoute } from "@/lib/api/v1/handler";
import { ok } from "@/lib/api/v1/envelope";
import { apiSendInvoice } from "@/lib/services/api-v1";

/** POST /api/v1/invoices/{id}/send — email/SMS the pay link to the buyer. */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = apiRoute<{ id: string }>(async (ctx, { id }) => {
  return ok(await apiSendInvoice(ctx, id));
});

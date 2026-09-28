import { apiRoute, parseJsonBody, parseQuery } from "@/lib/api/v1/handler";
import { createInvoiceBodySchema, listInvoicesQuerySchema } from "@/lib/api/v1/schemas";
import { ok } from "@/lib/api/v1/envelope";
import { apiCreateInvoice, apiListInvoices } from "@/lib/services/api-v1";

/**
 * GET  /api/v1/invoices  list invoices (status filter, page pagination)
 * POST /api/v1/invoices  create → risk screen → payment link (→ send)
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = apiRoute(async (ctx) => {
  const query = parseQuery(ctx.req, listInvoicesQuerySchema);
  const { data, pagination } = await apiListInvoices(ctx, query);
  return ok(data, { pagination });
});

export const POST = apiRoute(async (ctx) => {
  const body = await parseJsonBody(ctx.req, createInvoiceBodySchema);
  const invoice = await apiCreateInvoice(ctx, body);
  return ok(invoice, { status: 201 });
});

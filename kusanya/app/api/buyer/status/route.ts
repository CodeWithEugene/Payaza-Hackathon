import { err, json } from "@/lib/api/http";
import { getBuyerInvoice } from "@/lib/services/invoices";

/**
 * GET /api/buyer/status?token=… — public polling endpoint for the buyer's
 * payment page. Buyer-safe fields only: invoice status + currency + amount
 * and the collection transactions getBuyerInvoice already exposes (no
 * business internals beyond that projection).
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const token = new URL(req.url).searchParams.get("token");
    const inv = token ? await getBuyerInvoice(token) : null;
    if (!inv) return err(404, "Invoice link not found");

    return json({
      status: inv.invoice.status,
      currency: inv.invoice.currency,
      amountMinor: inv.invoice.amountMinor,
      transactions: inv.transactions,
    });
  } catch {
    return err(500, "Something went wrong on our side. The team has been alerted.");
  }
}

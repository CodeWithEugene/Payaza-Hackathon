import { err } from "@/lib/api/http";
import { pdfResponse } from "@/lib/api/pdf-response";
import { clientKey, createRateLimiter } from "@/lib/api/rate-limit";
import { isWellFormedToken, loadBuyerReceipt } from "@/lib/services/documents";
import { buildReceiptPdf, receiptNumber } from "@/lib/export/pdf/receipt-pdf";

/**
 * GET /api/buyer/receipt?token=… — public buyer receipt. The invoice token
 * is the capability (same model as /api/buyer/status). Only served once the
 * invoice has received money; buyer-safe fields only (no fees, nets, risk
 * or audit data). Rate limited per client to blunt token probing.
 */
export const dynamic = "force-dynamic";

const allow = createRateLimiter({ limit: 30, windowMs: 60_000 });

export async function GET(req: Request) {
  if (!allow(clientKey(req.headers))) return err(429, "Too many requests. Try again in a minute.");

  const token = new URL(req.url).searchParams.get("token");
  if (!isWellFormedToken(token)) return err(400, "A valid invoice link is required.");

  try {
    const data = await loadBuyerReceipt(token);
    if (!data) return err(404, "No receipt is available for this invoice yet.");
    return pdfResponse(buildReceiptPdf(data), `receipt-${receiptNumber(data.invoiceNumber)}`);
  } catch (e) {
    console.error("[api] buyer receipt failed:", e);
    return err(500, "Something went wrong on our side. The team has been alerted.");
  }
}

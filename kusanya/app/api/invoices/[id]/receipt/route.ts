import { err, routeSession } from "@/lib/api/http";
import { isNotFound, pdfResponse } from "@/lib/api/pdf-response";
import { loadMerchantReceipt } from "@/lib/services/documents";
import { buildReceiptPdf, receiptNumber } from "@/lib/export/pdf/receipt-pdf";

/**
 * GET /api/invoices/[id]/receipt — merchant receipt PDF (amounts received,
 * channel, Payaza reference, fee and net where Payaza reported them).
 * Session + business scoped (mustGetInvoice). 409 until money is received.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await routeSession(req);
  if (!session) return err(401, "Not signed in.");
  const { id } = await params;

  try {
    const data = await loadMerchantReceipt(id, session.businessId);
    if (!data) return err(409, "No payment has been received on this invoice yet.");
    return pdfResponse(buildReceiptPdf(data), `kusanya-receipt-${receiptNumber(data.invoiceNumber)}`);
  } catch (e) {
    if (isNotFound(e)) return err(404, "Invoice not found.");
    console.error("[api] receipt pdf failed:", e);
    return err(500, "Something went wrong on our side. The team has been alerted.");
  }
}

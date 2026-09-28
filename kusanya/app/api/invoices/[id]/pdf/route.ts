import { err, routeSession } from "@/lib/api/http";
import { isNotFound, pdfResponse } from "@/lib/api/pdf-response";
import { loadInvoiceDocument } from "@/lib/services/documents";
import { buildInvoicePdf } from "@/lib/export/pdf/invoice-pdf";

/**
 * GET /api/invoices/[id]/pdf — the invoice as a branded PDF. Session +
 * business scoped: loadInvoiceDocument goes through mustGetInvoice, so an
 * id from another business is a 404 (IDOR guard).
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await routeSession(req);
  if (!session) return err(401, "Not signed in.");
  const { id } = await params;

  try {
    const data = await loadInvoiceDocument(id, session.businessId);
    return pdfResponse(buildInvoicePdf(data), `kusanya-invoice-${data.number}`);
  } catch (e) {
    if (isNotFound(e)) return err(404, "Invoice not found.");
    console.error("[api] invoice pdf failed:", e);
    return err(500, "Something went wrong on our side. The team has been alerted.");
  }
}

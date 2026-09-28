import { z } from "zod";
import { err, json } from "@/lib/api/http";
import { getBuyerInvoice } from "@/lib/services/invoices";
import { startMomoCollection } from "@/lib/services/collections";

/**
 * POST /api/buyer/momo — public route (the buyer has no session; the invoice
 * token IS the capability). Resolves the invoice, checks it is payable,
 * derives the momo country from the invoice currency, and fires the prompt
 * through the collections service — persona error copy comes from there.
 */
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string().min(1),
  phone: z.string().min(7),
  network: z.string().min(2).max(16).optional(),
});

/** Currency → momo country (only local-currency invoices collect by momo). */
const CURRENCY_TO_COUNTRY: Record<string, "KE" | "UG" | "TZ"> = {
  KES: "KE",
  UGX: "UG",
  TZS: "TZ",
};

const PAYABLE_STATUSES = ["sent", "ready", "partially_paid"];

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return err(400, "We couldn't read that request. Please try again.");
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return err(400, "Enter a valid mobile money number (e.g. 07XX XXX XXX)");
  }
  const { token, phone, network } = parsed.data;

  try {
    const inv = await getBuyerInvoice(token);
    if (!inv) return err(400, "Invoice link not found");
    if (!PAYABLE_STATUSES.includes(inv.invoice.status)) {
      return err(400, `This invoice is not payable right now (status: ${inv.invoice.status})`);
    }
    const country = CURRENCY_TO_COUNTRY[inv.invoice.currency];
    if (!country) {
      return err(400, "Mobile money isn't available for this currency. Use the card button.");
    }

    const result = await startMomoCollection({
      invoiceId: inv.invoice.id,
      businessId: inv.invoice.businessId,
      phone,
      country,
      network,
    });

    return json({
      txnId: result.txnId,
      merchantReference: result.merchantReference,
      status: result.status,
      message: result.message,
    });
  } catch (e) {
    // Service already produced persona copy ("Enter a valid…", "Invoice is
    // in …", personaErrorCopy for Payaza failures) — surface it verbatim.
    return err(400, e instanceof Error ? e.message : String(e));
  }
}

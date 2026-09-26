import { z } from "zod";
import { err, json } from "@/lib/api/http";
import { env } from "@/lib/config/env";
import { getBuyerInvoice } from "@/lib/services/invoices";
import { startCheckoutSession } from "@/lib/services/collections";

/**
 * POST /api/buyer/checkout — public route. Resolves the invoice by token,
 * checks it is payable, and mints a Payaza Checkout SDK config (splits ride
 * through when attached). In Demo Mode without sandbox keys it returns
 * {demo:true, reason} so the buyer UI can explain honestly instead of
 * opening a popup that cannot work.
 */
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string().min(1),
});

const PAYABLE_STATUSES = ["sent", "ready", "partially_paid"];

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return err(400, "We couldn't read that request. Please try again.");
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) return err(400, "Invoice link not found");

  try {
    const inv = await getBuyerInvoice(parsed.data.token);
    if (!inv) return err(400, "Invoice link not found");
    if (!PAYABLE_STATUSES.includes(inv.invoice.status)) {
      return err(400, `This invoice is not payable right now (status: ${inv.invoice.status})`);
    }

    if (env.DEMO_MODE && !env.PAYAZA_PUBLIC_KEY) {
      return json({
        demo: true,
        reason:
          "Card checkout needs Payaza sandbox keys. In Demo Mode, use the merchant-side 'Demo controls' or the mobile-money flow.",
      });
    }

    const session = await startCheckoutSession(inv.invoice.id, inv.invoice.businessId, {
      useSplits: true,
    });
    return json({
      demo: false,
      sdkConfig: session.sdkConfig,
      merchantReference: session.merchantReference,
    });
  } catch (e) {
    // Persona copy already produced by the service — surface verbatim.
    return err(400, e instanceof Error ? e.message : String(e));
  }
}

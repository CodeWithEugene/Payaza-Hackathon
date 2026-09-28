import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { env } from "@/lib/config/env";
import { db } from "@/lib/db/client";
import { invoices, transactions } from "@/lib/db/schema";
import { processWebhookPayload } from "@/lib/services/webhooks";
import { simulateSettlement } from "@/lib/services/payouts";
import { routeSession, err, handle } from "@/lib/api/http";
import { minorToMajor } from "@/lib/money/format";
import type { CurrencyCode } from "@/lib/money/currencies";
import {
  demoWebhookCollectionSuccess,
  demoWebhookCollectionFailed,
  demoWebhookMomoKESCollection,
  demoWebhookPayoutSuccess,
  demoWebhookPayoutFailed,
} from "@/lib/payaza/demo-payloads";

/**
 * POST /api/demo/replay — Demo Mode ONLY (404 otherwise). Replays synthetic
 * Payaza webhook fixtures through the SAME processing pipeline as live
 * webhooks (processWebhookPayload) — the demo never fakes ledger state
 * directly (build.md §14: one code path).
 */
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  event: z.enum([
    "collection.success",
    "collection.underpay",
    "collection.overpay",
    "collection.failed",
    "momo.success",
    "payout.success",
    "payout.failed",
    "settlement.complete",
  ]),
  /** Our merchant reference (KSN-…) of the transaction to resolve. */
  reference: z.string().min(4).max(40),
});

export async function POST(req: Request) {
  if (!env.DEMO_TOOLS) return err(404, "Not found");
  const session = await routeSession(req);
  if (!session) return err(401, "Not signed in.");
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return err(400, "invalid JSON");
  }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) return err(400, "Pick an event and a transaction reference.");
  const { event, reference } = parsed.data;

  return handle(async () => {
    // Scope check: reference must belong to the signed-in business.
    const [txn] = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.merchantReference, reference), eq(transactions.businessId, session.businessId)))
      .limit(1);
    if (!txn && event !== "settlement.complete") throw new Error("transaction not found");

    if (event === "settlement.complete") {
      const [inv] = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, reference), eq(invoices.businessId, session.businessId)))
        .limit(1);
      if (!inv) throw new Error("invoice not found");
      await simulateSettlement(inv.id, session.businessId);
      return { ok: true, event };
    }

    const amountMajor = minorToMajor(txn!.currency as CurrencyCode, Number(txn!.amountMinor));
    let fixture: unknown;
    switch (event) {
      case "collection.success":
        fixture = demoWebhookCollectionSuccess({
          merchant_reference: reference,
          amount: amountMajor,
          currency: txn!.currency,
          channel: txn!.channel === "card" ? "Card" : "KENYA_COLLECTIONS",
        });
        break;
      case "collection.underpay":
        fixture = demoWebhookCollectionSuccess({
          merchant_reference: reference,
          amount: Math.round(amountMajor * 0.85 * 100) / 100,
          currency: txn!.currency,
          amount_validation: "UNDERPAYMENT",
          channel: "Card",
        });
        break;
      case "collection.overpay":
        fixture = demoWebhookCollectionSuccess({
          merchant_reference: reference,
          amount: Math.round(amountMajor * 1.1 * 100) / 100,
          currency: txn!.currency,
          amount_validation: "OVERPAYMENT",
          channel: "Card",
        });
        break;
      case "collection.failed":
        fixture = demoWebhookCollectionFailed(reference, txn!.currency);
        break;
      case "momo.success":
        fixture = demoWebhookMomoKESCollection(reference, amountMajor);
        break;
      case "payout.success":
        fixture = demoWebhookPayoutSuccess(reference);
        break;
      case "payout.failed":
        fixture = demoWebhookPayoutFailed(reference);
        break;
    }

    const result = await processWebhookPayload(fixture, {
      signatureValid: false,
      demoReplay: true,
    });
    return { ok: result.outcome === "processed", event, outcome: result.outcome, detail: result.detail };
  });
}

import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { invoiceSplits, splitBeneficiaries, transactions, type Invoice } from "@/lib/db/schema";
import { buildWaterfall, feePercent, KUSANYA_TAKE_BPS, type WaterfallLine } from "@/lib/money/fees";
import { indicativeQuote } from "@/lib/money/fx";
import type { CurrencyCode } from "@/lib/money/currencies";

/**
 * Transparency waterfall computation (solution §10 — the trust feature).
 * Estimates until settlement; actuals (webhook fee/FX) replace them after.
 * Honest-states rule: every estimated line carries a note.
 */

/** Rail fee estimates used BEFORE the settlement webhook (pass-through). */
const ESTIMATED_RAIL_FEE_PCT: Record<string, number> = {
  card: 1.9,
  apple_pay: 1.9,
  google_pay: 1.9,
  payment_link: 1.9,
  momo_ke: 1.4,
  momo_ug: 1.5,
  momo_tz: 1.5,
};

/** M-Pesa/kepss disbursement fee estimate (deducted at payout). */
export const PAYOUT_RAIL_FEE_PCT = 1.0;

export interface InvoiceWaterfall {
  lines: WaterfallLine[];
  estimated: boolean;
  netMinor: number;
  netCurrency: CurrencyCode;
  fxRate: string | null;
  grossMinor: number;
  railFeeMinor: number;
  payoutFeeMinor: number; // estimated disbursement fee on the net
  settleEtaDays: string;
}

export async function invoiceWaterfall(
  invoice: Pick<Invoice, "id" | "currency" | "amountMinor" | "status" | "fxRate">,
): Promise<InvoiceWaterfall> {
  const currency = invoice.currency as CurrencyCode;
  const grossMinor = Number(invoice.amountMinor);

  const allTxns = await db
    .select()
    .from(transactions)
    .where(eq(transactions.invoiceId, invoice.id));
  const completedIn = allTxns.find((t) => t.kind === "collection" && t.status === "completed");
  const railFeeMinor = completedIn
    ? Number(completedIn.feeMinor ?? 0)
    : feePercent(grossMinor, ESTIMATED_RAIL_FEE_PCT[allTxns[0]?.channel ?? "card"] ?? 1.9);

  // Splits attached to this invoice.
  const splitRows = await db
    .select({ name: splitBeneficiaries.name, sharePct: invoiceSplits.sharePct })
    .from(invoiceSplits)
    .innerJoin(splitBeneficiaries, eq(splitBeneficiaries.id, invoiceSplits.beneficiaryId))
    .where(eq(invoiceSplits.invoiceId, invoice.id));
  const splits = splitRows.map((s) => ({
    name: s.name,
    bpsOrMinor: { kind: "bps" as const, value: Math.round(Number(s.sharePct ?? 0) * 100) },
  }));

  // FX to KES when invoice currency ≠ KES.
  let fxRate: string | null = invoice.fxRate ? String(invoice.fxRate) : null;
  let settleCurrency: CurrencyCode | undefined;
  if (currency !== "KES") {
    if (!fxRate) {
      const quote = indicativeQuote(currency, "KES");
      fxRate = quote?.rate ?? null;
    }
    settleCurrency = "KES";
  }

  const settled = ["settled", "paying_out", "completed"].includes(invoice.status);
  const lines = buildWaterfall(
    {
      grossMinor,
      railFeeMinor,
      kusanyaFeeBps: KUSANYA_TAKE_BPS,
      fxRate: fxRate ?? undefined,
      settleCurrency,
      splits,
    },
    currency,
    !settled,
  );

  const netLine = lines.find((l) => l.kind === "net")!;
  const payoutFeeMinor = feePercent(netLine.minor, PAYOUT_RAIL_FEE_PCT);

  return {
    lines,
    estimated: !settled,
    netMinor: netLine.minor - payoutFeeMinor,
    netCurrency: netLine.currency,
    fxRate,
    grossMinor,
    railFeeMinor,
    payoutFeeMinor,
    settleEtaDays: currency === "USD" ? "T+3 to 5 business days" : "T+1 business day",
  };
}

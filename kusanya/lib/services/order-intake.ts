import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { buyers, type Invoice } from "@/lib/db/schema";
import { isCurrency } from "@/lib/money/currencies";
import { issueInvoice } from "@/lib/services/invoice-pipeline";
import { extractFromText } from "@/lib/services/extraction";
import type { InvoiceExtractionResult, RiskDecision } from "@/lib/jev/types";

/**
 * Order intake from a chat channel (Telegram): the SAME pipeline the wizard
 * runs, minus the human review screen. Jev extraction (code resolves every
 * number/date) → create draft → risk screen (fail-closed) → on pass, finalize
 * (Payaza payment link) but DO NOT send: the merchant confirms with a tap.
 * Anything the pipeline cannot resolve is returned as a typed "needs" outcome
 * so the bot can ask for it instead of guessing.
 */

const MIN_DESCRIPTION_CHARS = 2;
const DEFAULT_DUE_DAYS = 7;

export type IntakeOutcome =
  | { kind: "ready"; invoice: Invoice; extraction: InvoiceExtractionResult; buyerName: string }
  | { kind: "flagged"; invoice: Invoice; decision: Exclude<RiskDecision, "pass">; buyerName: string }
  | { kind: "needs"; missing: ("total" | "buyer" | "currency")[]; extraction: InvoiceExtractionResult };

export async function draftInvoiceFromText(opts: {
  businessId: string;
  actorId: string;
  text: string;
}): Promise<IntakeOutcome> {
  const { extractionId, result, candidates } = await extractFromText({
    businessId: opts.businessId,
    text: opts.text,
    sourceType: "paste",
  });

  const currency = typeof result.currency.value === "string" ? result.currency.value : null;
  const totalMinor = typeof result.total.value === "number" ? result.total.value : null;
  const buyerName = typeof result.buyer.value === "string" ? result.buyer.value.trim() : "";
  const missing: ("total" | "buyer" | "currency")[] = [];
  if (!totalMinor || totalMinor <= 0) missing.push("total");
  if (!result.buyerCandidateId && buyerName.length < MIN_DESCRIPTION_CHARS) missing.push("buyer");
  if (!currency || !isCurrency(currency)) missing.push("currency");
  if (missing.length > 0) return { kind: "needs", missing, extraction: result };

  const matched = result.buyerCandidateId ? candidates.find((c) => c.id === result.buyerCandidateId) : undefined;
  // Same create + risk screen + payment link path as the wizard and the API;
  // sendNow false: the merchant confirms with a tap in Telegram.
  const { invoice, riskDecision } = await issueInvoice({
    businessId: opts.businessId,
    actorId: opts.actorId,
    buyer: matched ? { existingId: matched.id } : { name: buyerName, kind: "company" },
    items: result.items
      .filter((i) => i.description.trim().length >= MIN_DESCRIPTION_CHARS && i.qty > 0)
      .map((i) => ({ description: i.description.trim(), qty: i.qty, unitPriceMinor: i.unitPriceMinor })),
    totalMinor: totalMinor!,
    currency: currency!,
    dueAt: dueAtFrom(result.dueDate.value),
    feeBearer: "business",
    extractionId,
    sendNow: false,
  });
  const [buyerRow] = await db.select({ name: buyers.name }).from(buyers).where(eq(buyers.id, invoice.buyerId)).limit(1);
  const displayName = buyerRow?.name ?? buyerName;
  if (riskDecision !== "pass") return { kind: "flagged", invoice, decision: riskDecision, buyerName: displayName };
  return { kind: "ready", invoice, extraction: result, buyerName: displayName };
}

function dueAtFrom(value: unknown): string {
  if (typeof value === "string") {
    const d = new Date(`${value.slice(0, 10)}T09:00:00Z`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const fallback = new Date();
  fallback.setUTCDate(fallback.getUTCDate() + DEFAULT_DUE_DAYS);
  fallback.setUTCHours(9, 0, 0, 0);
  return fallback.toISOString();
}

import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { buyers, type Invoice } from "@/lib/db/schema";
import { isCurrency } from "@/lib/money/currencies";
import { createInvoice, finalizeInvoice } from "@/lib/services/invoices";
import { screenInvoice } from "@/lib/services/risk";
import { loadBuyerCandidates, loadBuyerHistory, runExtraction } from "@/lib/services/extraction";
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
  const candidates = await loadBuyerCandidates(opts.businessId);
  const prematch = bestCandidate(opts.text, candidates);
  const history = await loadBuyerHistory(opts.businessId, prematch?.id ?? null);

  const { extractionId, result } = await runExtraction({
    businessId: opts.businessId,
    text: opts.text,
    ocrText: null,
    sourceType: "paste",
    photoUrl: null,
    buyerCandidates: candidates.map((c) => ({ id: c.id, name: c.name, country: c.country ?? undefined })),
    history,
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
  const invoice = await createInvoice({
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
  });

  const [buyerRow] = await db.select().from(buyers).where(eq(buyers.id, invoice.buyerId)).limit(1);
  const buyerHistory = await loadBuyerHistory(opts.businessId, invoice.buyerId);
  const { result: risk } = await screenInvoice({
    invoice: { id: invoice.id, status: invoice.status },
    text: opts.text,
    buyerName: buyerRow?.name ?? buyerName,
    buyerCountry: buyerRow?.country ?? "KE",
    isFirstBuyer: buyerHistory.isFirstBuyer,
    invoiceTotalMinor: totalMinor!,
    historyAverageMinor: buyerHistory.averageMinor,
  });
  const displayName = buyerRow?.name ?? buyerName;
  if (risk.decision !== "pass") {
    return { kind: "flagged", invoice, decision: risk.decision, buyerName: displayName };
  }
  const ready = await finalizeInvoice(invoice.id, opts.businessId);
  return { kind: "ready", invoice: ready, extraction: result, buyerName: displayName };
}

/** Same deterministic token-overlap prematch the wizard's extract route uses. */
function bestCandidate<T extends { name: string }>(text: string, candidates: T[]): T | null {
  const lower = text.toLowerCase();
  let best: T | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const score = c.name
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 3 && lower.includes(t)).length;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
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

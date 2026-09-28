import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { aiExtractions, buyers, type Invoice } from "@/lib/db/schema";
import {
  createInvoice,
  finalizeInvoice,
  mustGetInvoice,
  sendInvoice,
  type CreateInvoiceInput,
} from "./invoices";
import { screenInvoice } from "./risk";
import { loadBuyerHistory } from "./extraction";
import type { RiskDecision } from "@/lib/jev/types";

/**
 * The one invoice-issuing pipeline, shared by the wizard (server action) and
 * the public API: create (draft) → risk screen → pass: finalize (Payaza
 * payment link) and optionally send; review/hold: stop in the review queue.
 */

export interface IssueInvoiceInput extends CreateInvoiceInput {
  sendNow: boolean;
}

export interface IssueInvoiceResult {
  invoice: Invoice;
  riskDecision: RiskDecision;
  riskScore: number;
}

export async function issueInvoice(input: IssueInvoiceInput): Promise<IssueInvoiceResult> {
  const created = await createInvoice(input);

  // Risk screening uses the extraction's source text when present (scoped).
  let sourceText: string | null = null;
  if (input.extractionId) {
    const [ext] = await db
      .select({ sourceText: aiExtractions.sourceText })
      .from(aiExtractions)
      .where(and(eq(aiExtractions.id, input.extractionId), eq(aiExtractions.businessId, input.businessId)))
      .limit(1);
    sourceText = ext?.sourceText ?? null;
  }

  const [buyerRow] = await db.select().from(buyers).where(eq(buyers.id, created.buyerId)).limit(1);
  const fallbackName = "existingId" in input.buyer ? "" : input.buyer.name;
  const fallbackCountry = "existingId" in input.buyer ? "KE" : (input.buyer.country ?? "KE");
  const history = await loadBuyerHistory(input.businessId, created.buyerId);
  const { result } = await screenInvoice({
    invoice: { id: created.id, status: created.status },
    text: sourceText,
    buyerName: buyerRow?.name ?? fallbackName,
    buyerCountry: buyerRow?.country ?? fallbackCountry,
    isFirstBuyer: history.isFirstBuyer,
    invoiceTotalMinor: input.totalMinor,
    historyAverageMinor: history.averageMinor,
  });

  if (result.decision === "pass") {
    await finalizeInvoice(created.id, input.businessId);
    if (input.sendNow) await sendInvoice(created.id, input.businessId, input.actorId);
  }

  const invoice = await mustGetInvoice(created.id, input.businessId);
  return { invoice, riskDecision: result.decision, riskScore: result.score };
}

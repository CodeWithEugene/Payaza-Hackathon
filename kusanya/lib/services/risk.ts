import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { invoices, riskAssessments, type Invoice } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { assessRisk, type RiskInput } from "@/lib/jev/risk-composite";
import type { RiskAssessmentResult } from "@/lib/jev/types";
import { writeAudit } from "@/lib/db/audit";
import { assertInvoiceTransition } from "@/lib/payaza/state-machine";

/**
 * Risk service — screens an invoice, persists the assessment, and moves the
 * invoice to review/on_hold when required (build.md §7, §6.5).
 */

export interface ScreenInvoiceInput {
  invoice: Pick<Invoice, "id" | "status">;
  text?: string | null;
  buyerName: string;
  buyerCountry: string;
  isFirstBuyer: boolean;
  invoiceTotalMinor: number | null;
  historyAverageMinor?: number | null;
  nameMismatch?: { expected: string; got: string } | null;
}

export async function screenInvoice(
  input: ScreenInvoiceInput,
): Promise<{ assessmentId: string; result: RiskAssessmentResult }> {
  const riskInput: RiskInput = {
    text: input.text,
    buyerName: input.buyerName,
    buyerCountry: input.buyerCountry,
    isFirstBuyer: input.isFirstBuyer,
    invoiceTotalMinor: input.invoiceTotalMinor,
    historyAverageMinor: input.historyAverageMinor,
    nameMismatch: input.nameMismatch,
  };
  const result = await assessRisk(riskInput);

  const assessmentId = newId("rsk");
  await db.insert(riskAssessments).values({
    id: assessmentId,
    invoiceId: input.invoice.id,
    compositeScore: result.score,
    decision: result.decision,
    reasons: result.criteria,
    jevAnswerId: result.jevAnswerId ?? null,
    fallback: result.source !== "jev",
  });

  // Invoice state effects: review → `review`, hold → `on_hold` (from draft/ready/sent).
  const target =
    result.decision === "hold"
      ? "on_hold"
      : result.decision === "review"
        ? "review"
        : null;
  if (target && canMoveToReview(input.invoice.status)) {
    assertInvoiceTransition(input.invoice.status as never, target as never);
    await db
      .update(invoices)
      .set({ status: target as Invoice["status"], updatedAt: new Date() })
      .where(eq(invoices.id, input.invoice.id));
  }

  await writeAudit({
    actor: result.source === "jev" ? "jev" : "system",
    action: "invoice.risk_assessed",
    entityType: "invoices",
    entityId: input.invoice.id,
    after: {
      score: result.score,
      decision: result.decision,
      source: result.source,
      criteria: result.criteria,
    },
    aiRef: assessmentId,
  });

  return { assessmentId, result };
}

function canMoveToReview(status: string): boolean {
  return ["draft", "ready", "sent"].includes(status);
}

/** Merchant override: resolve review → ready, or on_hold → review (compliance). */
export async function overrideRiskDecision(
  invoiceId: string,
  currentStatus: Invoice["status"],
  to: "ready" | "review" | "cancelled",
  actorId: string,
  note: string,
): Promise<void> {
  assertInvoiceTransition(currentStatus, to);
  await db
    .update(invoices)
    .set({ status: to, updatedAt: new Date() })
    .where(eq(invoices.id, invoiceId));
  await writeAudit({
    actor: actorId,
    action: "invoice.risk_override",
    entityType: "invoices",
    entityId: invoiceId,
    before: { status: currentStatus },
    after: { status: to, note },
  });
}

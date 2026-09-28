import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { aiExtractions, buyers, invoices, transactions } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { extractInvoice, type ExtractionInput } from "@/lib/jev/invoice-extraction";
import { writeAudit } from "@/lib/db/audit";
import type { InvoiceExtractionResult } from "@/lib/jev/types";

/**
 * Extraction service — wraps the Jev pipeline with persistence + audit
 * (build.md §7: raw request/response persisted to ai_extractions).
 */

export interface RunExtractionInput extends ExtractionInput {
  businessId: string;
  sourceType: "snap" | "paste" | "manual";
  photoUrl?: string | null;
}

export interface RunExtractionOutput {
  extractionId: string;
  result: InvoiceExtractionResult;
}

export async function runExtraction(
  input: RunExtractionInput,
): Promise<RunExtractionOutput> {
  const started = Date.now();
  const result = await extractInvoice({
    text: input.text,
    ocrText: input.ocrText,
    buyerCandidates: input.buyerCandidates,
    history: input.history,
  });

  const extractionId = newId("ext");
  await db.insert(aiExtractions).values({
    id: extractionId,
    businessId: input.businessId,
    sourceType: input.sourceType,
    sourceText: input.text.slice(0, 20_000),
    photoUrl: input.photoUrl ?? null,
    jevRequest: {
      model: result.model,
      buyerCandidates: input.buyerCandidates.length,
      sourceChars: input.text.length,
    },
    jevResponse: result.rawAnswers,
    quality: result.quality.toFixed(3),
    durationMs: Date.now() - started,
  });

  await writeAudit({
    actor: result.model.startsWith("demo") ? "system" : "jev",
    action: "extraction.completed",
    entityType: "ai_extractions",
    entityId: extractionId,
    after: {
      model: result.model,
      quality: result.quality,
      fields: {
        buyer: result.buyer.value,
        total: result.total.value,
        currency: result.currency.value,
        dueDate: result.dueDate.value,
      },
    },
    aiRef: extractionId,
  });

  return { extractionId, result };
}

/** Buyer directory candidates for extraction (name/country only — minimal PII). */
export async function loadBuyerCandidates(businessId: string) {
  const rows = await db
    .select({
      id: buyers.id,
      name: buyers.name,
      country: buyers.country,
      email: buyers.email,
      phone: buyers.phone,
    })
    .from(buyers)
    .where(eq(buyers.businessId, businessId));
  return rows;
}

/** Historical average + first-buyer fact for risk/extraction context. */
export async function loadBuyerHistory(businessId: string, buyerId: string | null) {
  if (!buyerId) return { averageMinor: null, isFirstBuyer: true };
  const rows = await db
    .select({
      avg: sql<string>`avg(${transactions.amountMinor})`,
      count: sql<number>`count(${transactions.id})`,
    })
    .from(transactions)
    .innerJoin(invoices, eq(invoices.id, transactions.invoiceId))
    .where(
      and(
        eq(invoices.businessId, businessId),
        eq(invoices.buyerId, buyerId),
        eq(transactions.kind, "collection"),
        eq(transactions.status, "completed"),
      ),
    );
  const count = Number(rows[0]?.count ?? 0);
  const avg = rows[0]?.avg != null ? Number(rows[0].avg) : null;
  return {
    averageMinor: count > 0 && avg != null && Number.isFinite(avg) ? Math.round(avg) : null,
    isFirstBuyer: count === 0,
  };
}

/**
 * Full text → fields pipeline used by the wizard route and the public API:
 * load the buyer directory, pre-match the best candidate deterministically
 * (token overlap) to supply history context, then one batched Jev call.
 */
export async function extractFromText(input: {
  businessId: string;
  text: string;
  ocrText?: string | null;
  sourceType: "snap" | "paste" | "manual";
  photoUrl?: string | null;
}) {
  const candidates = await loadBuyerCandidates(input.businessId);
  const lower = input.text.toLowerCase();
  let best: (typeof candidates)[number] | null = null;
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
  const history = await loadBuyerHistory(input.businessId, best?.id ?? null);

  const { extractionId, result } = await runExtraction({
    businessId: input.businessId,
    text: input.text,
    ocrText: input.ocrText ?? null,
    sourceType: input.sourceType,
    photoUrl: input.photoUrl ?? null,
    buyerCandidates: candidates.map((c) => ({ id: c.id, name: c.name, country: c.country ?? undefined })),
    history,
  });
  return { extractionId, result, candidates };
}

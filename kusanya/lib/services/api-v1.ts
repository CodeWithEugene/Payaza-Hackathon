import "server-only";
import { and, count, desc, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { buyers, riskAssessments, transactions, type RiskAssessment } from "@/lib/db/schema";
import { getInvoiceDetail, listInvoices, sendInvoice } from "./invoices";
import { issueInvoice } from "./invoice-pipeline";
import { extractFromText } from "./extraction";
import {
  paidMinorFrom,
  serializeBuyer,
  serializeInvoice,
  serializeLineItem,
  serializePayment,
  type ApiInvoice,
} from "@/lib/api/v1/serializers";
import {
  dueDateToIso,
  invoiceTotalMinor,
  type CreateInvoiceBody,
} from "@/lib/api/v1/schemas";
import { ApiError, type Pagination } from "@/lib/api/v1/envelope";
import type { ApiContext } from "@/lib/api/v1/handler";

/**
 * Public API v1 use cases. Thin adapters over the same services the web app
 * uses (invoices, invoice-pipeline, extraction); every query is scoped to
 * ctx.businessId, which comes only from the authenticated key.
 */

function pagination(page: number, limit: number, total: number): Pagination {
  return { page, limit, total, has_more: page * limit < total };
}

function riskSummary(row: Pick<RiskAssessment, "decision" | "compositeScore"> | undefined) {
  return row ? { decision: row.decision, score: row.compositeScore } : null;
}

async function latestRiskByInvoice(invoiceIds: string[]) {
  if (invoiceIds.length === 0) return new Map<string, RiskAssessment>();
  const rows = await db
    .select()
    .from(riskAssessments)
    .where(inArray(riskAssessments.invoiceId, invoiceIds))
    .orderBy(desc(riskAssessments.createdAt));
  const latest = new Map<string, RiskAssessment>();
  for (const row of rows) if (!latest.has(row.invoiceId)) latest.set(row.invoiceId, row);
  return latest;
}

export async function apiListInvoices(
  ctx: ApiContext,
  query: { status: string[]; page: number; limit: number },
) {
  const result = await listInvoices(ctx.businessId, {
    status: query.status as never,
    page: query.page,
    pageSize: query.limit,
  });
  const risks = await latestRiskByInvoice(result.rows.map((r) => r.invoice.id));
  const data = result.rows.map((r) =>
    serializeInvoice(r.invoice, {
      appUrl: ctx.appUrl,
      buyer: { id: r.invoice.buyerId, name: r.buyerName, country: r.buyerCountry },
      paidMinor: r.paidMinor,
      risk: riskSummary(risks.get(r.invoice.id)),
    }),
  );
  return { data, pagination: pagination(query.page, query.limit, result.total) };
}

export async function apiGetInvoice(ctx: ApiContext, invoiceId: string) {
  const detail = await getInvoiceDetail(ctx.businessId, invoiceId);
  const invoice: ApiInvoice = serializeInvoice(detail.invoice, {
    appUrl: ctx.appUrl,
    buyer: detail.buyer ?? null,
    paidMinor: paidMinorFrom(detail.transactions),
    risk: riskSummary(detail.risk),
  });
  return {
    ...invoice,
    line_items: detail.items.map(serializeLineItem),
    payments: detail.transactions.map(serializePayment),
  };
}

export async function apiCreateInvoice(ctx: ApiContext, body: CreateInvoiceBody) {
  const totalMinor = invoiceTotalMinor(body.line_items);
  if (totalMinor <= 0) {
    throw new ApiError("validation_error", "The invoice total must be greater than zero.", [
      { path: "line_items", message: "Sum of quantity × unit_price_minor must be positive." },
    ]);
  }
  const buyer = body.buyer.id
    ? { existingId: body.buyer.id }
    : {
        name: body.buyer.name!,
        kind: body.buyer.kind ?? "company",
        country: body.buyer.country ?? "KE",
        email: body.buyer.email ?? null,
        phone: body.buyer.phone ?? null,
      };

  const { invoice } = await issueInvoice({
    businessId: ctx.businessId,
    actorId: ctx.actorId,
    buyer,
    items: body.line_items.map((it) => ({
      description: it.description,
      qty: it.quantity,
      unitPriceMinor: it.unit_price_minor,
    })),
    totalMinor,
    currency: body.currency,
    dueAt: dueDateToIso(body.due_date),
    notes: body.notes ?? null,
    feeBearer: body.fee_bearer,
    extractionId: body.extraction_id ?? null,
    sendNow: body.send,
  });
  return apiGetInvoice(ctx, invoice.id);
}

export async function apiSendInvoice(ctx: ApiContext, invoiceId: string) {
  await sendInvoice(invoiceId, ctx.businessId, ctx.actorId);
  return apiGetInvoice(ctx, invoiceId);
}

export async function apiListPayments(
  ctx: ApiContext,
  query: { invoice_id?: string; kind?: string; status?: string; page: number; limit: number },
) {
  const conditions: SQL[] = [eq(transactions.businessId, ctx.businessId)];
  if (query.invoice_id) conditions.push(eq(transactions.invoiceId, query.invoice_id));
  if (query.kind) conditions.push(eq(transactions.kind, query.kind as never));
  if (query.status) conditions.push(eq(transactions.status, query.status as never));
  const where = and(...conditions);
  const rows = await db
    .select()
    .from(transactions)
    .where(where)
    .orderBy(desc(transactions.createdAt), desc(transactions.id))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit);
  const [total] = await db.select({ n: count() }).from(transactions).where(where);
  return {
    data: rows.map(serializePayment),
    pagination: pagination(query.page, query.limit, Number(total?.n ?? 0)),
  };
}

export async function apiListBuyers(ctx: ApiContext, query: { page: number; limit: number }) {
  const where = eq(buyers.businessId, ctx.businessId);
  const rows = await db
    .select()
    .from(buyers)
    .where(where)
    .orderBy(desc(buyers.createdAt), desc(buyers.id))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit);
  const [total] = await db.select({ n: count() }).from(buyers).where(where);
  return {
    data: rows.map(serializeBuyer),
    pagination: pagination(query.page, query.limit, Number(total?.n ?? 0)),
  };
}

function field<T>(f: { value: T | null; confidence: number; snippet: string | null }) {
  return { value: f.value, confidence: f.confidence, snippet: f.snippet };
}

export async function apiExtract(ctx: ApiContext, text: string) {
  const { extractionId, result } = await extractFromText({
    businessId: ctx.businessId,
    text,
    sourceType: "paste",
  });
  return {
    extraction_id: extractionId,
    object: "extraction",
    model: result.model,
    quality: result.quality,
    duration_ms: result.durationMs,
    buyer: { ...field(result.buyer), matched_buyer_id: result.buyerCandidateId },
    currency: field(result.currency),
    total: {
      value: result.total.value != null ? String(result.total.value) : null,
      confidence: result.total.confidence,
      snippet: result.total.snippet,
    },
    due_date: field(result.dueDate),
    firm_order: field(result.firmOrder),
    line_items: result.items.map((it) => ({
      description: it.description,
      quantity: it.qty,
      unit_price_minor: it.unitPriceMinor != null ? String(it.unitPriceMinor) : null,
      currency: it.currency,
      confidence: it.confidence,
    })),
  };
}

import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { buyers, businesses, invoiceItems, invoices, transactions, type Invoice } from "@/lib/db/schema";
import { mustGetBusiness, mustGetInvoice } from "@/lib/services/invoices";
import { channelText, dateText, dateTimeText, moneyText, statusText } from "@/lib/export/format";
import type { InvoicePdfData } from "@/lib/export/pdf/invoice-pdf";
import type { ReceiptPdfData } from "@/lib/export/pdf/receipt-pdf";

/**
 * Loaders that turn DB rows into the pre-formatted, serializable shapes the
 * PDF builders in lib/export/pdf consume. Merchant loaders are business
 * scoped through mustGetInvoice (IDOR guard); the buyer loader is scoped by
 * the public token and projects buyer-safe fields only.
 */

/** Documents are stamped in East Africa Time, the merchants' home zone. */
export const DOC_TIME = { timeZone: "Africa/Nairobi", zoneLabel: "EAT" } as const;
const TZ = DOC_TIME.timeZone;

/** Statuses where money has been received and a receipt is meaningful. */
export const RECEIPT_STATUSES: readonly Invoice["status"][] = [
  "partially_paid",
  "paid",
  "settling",
  "settled",
  "paying_out",
  "completed",
];

/**
 * Public buyer tokens: `tok_` + ulid (lib/ids.newPublicToken) or the demo
 * seed's base36 variant. Shape-check before touching the DB.
 */
const TOKEN_RE = /^tok_[0-9a-z]{8,36}$/;

export function isWellFormedToken(token: string | null | undefined): token is string {
  return typeof token === "string" && TOKEN_RE.test(token);
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

async function loadItems(invoice: Invoice) {
  return db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoice.id))
    .orderBy(invoiceItems.position);
}

async function loadCollections(invoiceId: string) {
  return db
    .select()
    .from(transactions)
    .where(and(eq(transactions.invoiceId, invoiceId), eq(transactions.kind, "collection")))
    .orderBy(desc(transactions.createdAt));
}

type Collection = Awaited<ReturnType<typeof loadCollections>>[number];

/** Completed collection totals per currency (never summed across currencies). */
function totalsByCurrency(done: Collection[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const t of done) {
    totals.set(t.currency, (totals.get(t.currency) ?? 0) + Math.round(Number(t.amountMinor)));
  }
  return totals;
}

/**
 * Remaining balance (never below zero), only when every payment was in the
 * invoice currency. null when payments were mixed-currency: we never guess.
 */
function balanceMinor(invoice: Invoice, totals: Map<string, number>): number | null {
  if (totals.size !== 1 || !totals.has(invoice.currency)) return null;
  const remaining = Math.round(Number(invoice.amountMinor)) - (totals.get(invoice.currency) ?? 0);
  return Math.max(0, remaining);
}

/** Buyer can still pay online only in these states. */
const PAYABLE_STATUSES: readonly Invoice["status"][] = ["ready", "sent", "partially_paid"];

function itemRows(invoice: Invoice, items: Awaited<ReturnType<typeof loadItems>>) {
  return items.map((it) => {
    const qty = Number(it.qty);
    const unit = Math.round(Number(it.unitPriceMinor));
    const cur = it.currency || invoice.currency;
    const hasBoth = qty > 0 && unit > 0;
    return {
      description: it.description,
      qty: Number.isFinite(qty) ? String(qty) : it.qty,
      unitPrice: unit > 0 ? moneyText(cur, unit) : "",
      // Line total = qty × unit, rounded once to whole minor units.
      lineTotal: hasBoth ? moneyText(cur, Math.round(qty * unit)) : "",
    };
  });
}

// ------------------------------------------------------------ merchant --

export async function loadInvoiceDocument(invoiceId: string, businessId: string): Promise<InvoicePdfData> {
  const invoice = await mustGetInvoice(invoiceId, businessId);
  const business = await mustGetBusiness(businessId);
  const [buyer] = await db.select().from(buyers).where(eq(buyers.id, invoice.buyerId)).limit(1);
  const items = await loadItems(invoice);
  const done = (await loadCollections(invoice.id)).filter((t) => t.status === "completed");
  const totals = totalsByCurrency(done);
  const paidInCurrency = totals.get(invoice.currency) ?? 0;
  const balance = balanceMinor(invoice, totals);

  return {
    business: { name: business.name, country: business.country },
    buyer: buyer
      ? { name: buyer.name, country: buyer.country, email: buyer.email, phone: buyer.phone }
      : null,
    number: invoice.number,
    statusLabel: statusText(invoice.status),
    issuedLabel: dateText(invoice.issuedAt ?? invoice.createdAt, TZ),
    dueLabel: invoice.dueAt ? dateText(invoice.dueAt, TZ) : "On receipt",
    currency: invoice.currency,
    items: itemRows(invoice, items),
    totalDisplay: moneyText(invoice.currency, invoice.amountMinor),
    paidDisplay: paidInCurrency > 0 ? moneyText(invoice.currency, paidInCurrency) : null,
    balanceDisplay: paidInCurrency > 0 && balance !== null ? moneyText(invoice.currency, balance) : null,
    notes: invoice.notes,
    paymentUrl: PAYABLE_STATUSES.includes(invoice.status) ? `${appUrl()}/i/${invoice.token}` : null,
    feeNote:
      invoice.feeBearer === "customer" ? "Payment processing fees are added at checkout." : null,
    ...DOC_TIME,
  };
}

interface ReceiptScope {
  invoice: Invoice;
  businessName: string;
  businessCountry: string | null;
  buyer: { name: string; country: string | null } | null;
}

function buildReceipt(
  scope: ReceiptScope,
  done: Collection[],
  audience: ReceiptPdfData["audience"],
): ReceiptPdfData {
  const { invoice } = scope;
  const totals = totalsByCurrency(done);
  const balance = balanceMinor(invoice, totals);
  const lastPaid = done
    .map((t) => t.occurredAt ?? t.createdAt)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return {
    audience,
    business: { name: scope.businessName, country: scope.businessCountry },
    buyer: scope.buyer,
    invoiceNumber: invoice.number,
    invoiceTotalDisplay: moneyText(invoice.currency, invoice.amountMinor),
    statusLabel: statusText(invoice.status),
    receivedTotals: [...totals.entries()].map(([cur, minor]) => moneyText(cur, minor)),
    paidOnLabel: dateText(lastPaid, TZ),
    payments: done.map((t) => ({
      dateLabel: dateTimeText(t.occurredAt ?? t.createdAt, TZ),
      method: channelText(t.channel),
      merchantReference: t.merchantReference,
      payazaReference: t.payazaReference,
      amount: moneyText(t.currency, t.amountMinor),
      ...(audience === "merchant"
        ? {
            fee: t.feeMinor != null ? moneyText(t.currency, t.feeMinor) : null,
            net: t.netMinor != null ? moneyText(t.currency, t.netMinor) : null,
          }
        : {}),
    })),
    balanceDisplay:
      invoice.status === "partially_paid" && balance !== null && balance > 0
        ? moneyText(invoice.currency, balance)
        : null,
    ...DOC_TIME,
  };
}

/** Merchant receipt, or null when no money has been received yet. */
export async function loadMerchantReceipt(
  invoiceId: string,
  businessId: string,
): Promise<ReceiptPdfData | null> {
  const invoice = await mustGetInvoice(invoiceId, businessId);
  if (!RECEIPT_STATUSES.includes(invoice.status)) return null;
  const done = (await loadCollections(invoice.id)).filter((t) => t.status === "completed");
  if (done.length === 0) return null;
  const business = await mustGetBusiness(businessId);
  const [buyer] = await db
    .select({ name: buyers.name, country: buyers.country })
    .from(buyers)
    .where(eq(buyers.id, invoice.buyerId))
    .limit(1);
  return buildReceipt(
    {
      invoice,
      businessName: business.name,
      businessCountry: business.country,
      buyer: buyer ?? null,
    },
    done,
    "merchant",
  );
}

// --------------------------------------------------------------- buyer --

/**
 * Buyer receipt by public token. Returns null unless the invoice exists and
 * has received money. Buyer-safe: no fees, nets, risk or audit fields.
 */
export async function loadBuyerReceipt(token: string): Promise<ReceiptPdfData | null> {
  if (!isWellFormedToken(token)) return null;
  const [invoice] = await db.select().from(invoices).where(eq(invoices.token, token)).limit(1);
  if (!invoice || !RECEIPT_STATUSES.includes(invoice.status)) return null;
  const done = (await loadCollections(invoice.id)).filter((t) => t.status === "completed");
  if (done.length === 0) return null;
  const [biz] = await db
    .select({ name: businesses.name, country: businesses.country })
    .from(businesses)
    .where(eq(businesses.id, invoice.businessId))
    .limit(1);
  const [buyer] = await db
    .select({ name: buyers.name, country: buyers.country })
    .from(buyers)
    .where(eq(buyers.id, invoice.buyerId))
    .limit(1);
  return buildReceipt(
    {
      invoice,
      businessName: biz?.name ?? "Your seller",
      businessCountry: biz?.country ?? null,
      buyer: buyer ?? null,
    },
    done,
    "buyer",
  );
}

/**
 * /pay-done helper: a KSN- merchant reference (ulid, unguessable, held by
 * the buyer who just paid) → the invoice token, only once that invoice has
 * received money. Anything else resolves to null.
 */
export async function receiptTokenForReference(reference: string): Promise<string | null> {
  if (!/^KSN-[0-9A-Z]{10,36}$/.test(reference)) return null;
  const [row] = await db
    .select({ token: invoices.token, status: invoices.status, txnStatus: transactions.status })
    .from(transactions)
    .innerJoin(invoices, eq(invoices.id, transactions.invoiceId))
    .where(and(eq(transactions.merchantReference, reference), eq(transactions.kind, "collection")))
    .limit(1);
  if (!row || row.txnStatus !== "completed" || !RECEIPT_STATUSES.includes(row.status)) return null;
  return row.token;
}

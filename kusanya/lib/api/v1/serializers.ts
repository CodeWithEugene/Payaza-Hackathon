import type { Buyer, Invoice, InvoiceItem, Transaction } from "@/lib/db/schema";
import { fromNumericColumn } from "@/lib/money/format";

/**
 * DB rows → public API v1 objects (snake_case, stable field set).
 *
 * MONEY ON THE WIRE: every amount is `*_minor`, an integer encoded as a
 * STRING, in the minor unit of the adjacent `currency` (USD/KES: cents,
 * UGX/TZS: whole shillings). Never floats.
 */

export function minorString(value: string | null | undefined): string {
  return String(fromNumericColumn(value ?? "0"));
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function payUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/+$/, "")}/i/${token}`;
}

export interface ApiBuyer {
  id: string;
  object: "buyer";
  name: string;
  kind: "person" | "company";
  email: string | null;
  phone: string | null;
  country: string;
  created_at: string;
}

export function serializeBuyer(row: Buyer): ApiBuyer {
  return {
    id: row.id,
    object: "buyer",
    name: row.name,
    kind: row.kind,
    email: row.email,
    phone: row.phone,
    country: row.country,
    created_at: row.createdAt.toISOString(),
  };
}

export interface ApiLineItem {
  description: string;
  quantity: string;
  unit_price_minor: string;
  currency: string;
}

export function serializeLineItem(row: InvoiceItem): ApiLineItem {
  return {
    description: row.description,
    quantity: String(Number(row.qty)),
    unit_price_minor: minorString(row.unitPriceMinor),
    currency: row.currency,
  };
}

export interface ApiPayment {
  id: string;
  object: "payment";
  invoice_id: string | null;
  kind: Transaction["kind"];
  direction: Transaction["direction"];
  channel: Transaction["channel"];
  status: Transaction["status"];
  currency: string;
  amount_minor: string;
  fee_minor: string | null;
  net_minor: string | null;
  merchant_reference: string;
  payaza_reference: string | null;
  occurred_at: string | null;
  created_at: string;
}

export function serializePayment(row: Transaction): ApiPayment {
  return {
    id: row.id,
    object: "payment",
    invoice_id: row.invoiceId,
    kind: row.kind,
    direction: row.direction,
    channel: row.channel,
    status: row.status,
    currency: row.currency,
    amount_minor: minorString(row.amountMinor),
    fee_minor: row.feeMinor != null ? minorString(row.feeMinor) : null,
    net_minor: row.netMinor != null ? minorString(row.netMinor) : null,
    merchant_reference: row.merchantReference,
    payaza_reference: row.payazaReference,
    occurred_at: iso(row.occurredAt),
    created_at: row.createdAt.toISOString(),
  };
}

export interface ApiInvoice {
  id: string;
  object: "invoice";
  number: string;
  status: Invoice["status"];
  currency: string;
  amount_minor: string;
  amount_paid_minor: string;
  fee_bearer: string;
  buyer: { id: string; name: string; country: string } | null;
  due_at: string | null;
  issued_at: string | null;
  notes: string | null;
  pay_url: string;
  payment_link_url: string | null;
  risk: { decision: "pass" | "review" | "hold"; score: number } | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceExtras {
  appUrl: string;
  buyer?: Pick<Buyer, "id" | "name" | "country"> | null;
  paidMinor?: string | null;
  risk?: { decision: "pass" | "review" | "hold"; score: number } | null;
}

export function serializeInvoice(row: Invoice, extras: InvoiceExtras): ApiInvoice {
  return {
    id: row.id,
    object: "invoice",
    number: row.number,
    status: row.status,
    currency: row.currency,
    amount_minor: minorString(row.amountMinor),
    amount_paid_minor: String(Math.round(Number(extras.paidMinor ?? "0")) || 0),
    fee_bearer: row.feeBearer,
    buyer: extras.buyer ? { id: extras.buyer.id, name: extras.buyer.name, country: extras.buyer.country } : null,
    due_at: iso(row.dueAt),
    issued_at: iso(row.issuedAt),
    notes: row.notes,
    pay_url: payUrl(extras.appUrl, row.token),
    payment_link_url: row.payazaLinkUrl,
    risk: extras.risk ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

/** Sum of completed collections in minor units (string), from ledger rows. */
export function paidMinorFrom(rows: readonly Transaction[]): string {
  const total = rows
    .filter((t) => t.kind === "collection" && t.status === "completed")
    .reduce((sum, t) => sum + fromNumericColumn(t.amountMinor), 0);
  return String(total);
}

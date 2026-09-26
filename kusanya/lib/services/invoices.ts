import "server-only";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  buyers,
  businesses,
  invoiceItems,
  invoiceSplits,
  invoices,
  payouts,
  reminders,
  riskAssessments,
  splitBeneficiaries,
  transactions,
  type Business,
  type Invoice,
} from "@/lib/db/schema";
import { newId, newPublicToken, humanInvoiceNumber } from "@/lib/ids";
import { writeAudit } from "@/lib/db/audit";
import { assertInvoiceTransition } from "@/lib/payaza/state-machine";
import { publish } from "./events";
import { createPaymentLink } from "@/lib/payaza/endpoints";
import { toNumericColumn, formatMinor } from "@/lib/money/format";
import { isCurrency, type CurrencyCode } from "@/lib/money/currencies";
import { sendEmail } from "@/lib/notify/email";
import { sendSms } from "@/lib/notify/sms";
import { invoiceEmail } from "@/lib/notify/templates";

/**
 * Invoice service — creation from reviewed extraction, payment-link
 * finalization, sending, listing, and buyer-facing retrieval.
 * Every mutation: state-machine assert + audit + SSE publish.
 */

export interface CreateInvoiceInput {
  businessId: string;
  actorId: string;
  buyer:
    | { existingId: string }
    | {
        name: string;
        kind?: "person" | "company";
        country?: string;
        email?: string | null;
        phone?: string | null;
      };
  items: { description: string; qty: number; unitPriceMinor: number | null }[];
  totalMinor: number;
  currency: string;
  dueAt?: string | null;
  notes?: string | null;
  feeBearer?: "business" | "customer";
  extractionId?: string | null;
}

export async function createInvoice(
  input: CreateInvoiceInput,
): Promise<Invoice> {
  if (!isCurrency(input.currency)) throw new Error(`unsupported currency: ${input.currency}`);
  if (input.totalMinor <= 0) throw new Error("invoice total must be positive");

  // Buyer resolution (existing or create).
  let buyerId: string;
  let buyerName: string;
  if ("existingId" in input.buyer) {
    const rows = await db
      .select()
      .from(buyers)
      .where(and(eq(buyers.id, input.buyer.existingId), eq(buyers.businessId, input.businessId)))
      .limit(1);
    if (!rows[0]) throw new Error("buyer not found in this business scope");
    buyerId = rows[0].id;
    buyerName = rows[0].name;
  } else {
    buyerId = newId("buy");
    buyerName = input.buyer.name;
    await db.insert(buyers).values({
      id: buyerId,
      businessId: input.businessId,
      kind: input.buyer.kind ?? "person",
      name: buyerName,
      country: input.buyer.country ?? "KE",
      email: input.buyer.email ?? null,
      phone: input.buyer.phone ?? null,
    });
  }

  // Human number from per-business sequence (atomic).
  const year = new Date().getFullYear();
  const [bumped] = await db
    .update(businesses)
    .set({ invoiceSeq: sql`${businesses.invoiceSeq} + 1` })
    .where(eq(businesses.id, input.businessId))
    .returning();
  const seq = bumped?.invoiceSeq ?? 1;

  const id = newId("inv");
  const token = newPublicToken();
  const [invoice] = await db
    .insert(invoices)
    .values({
      id,
      businessId: input.businessId,
      buyerId,
      number: humanInvoiceNumber(year, seq),
      token,
      status: "draft",
      currency: input.currency,
      amountMinor: toNumericColumn(input.totalMinor),
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      notes: input.notes ?? null,
      feeBearer: input.feeBearer ?? "business",
      aiMeta: input.extractionId ? { extractionId: input.extractionId } : null,
    })
    .returning();

  if (input.items.length > 0) {
    await db.insert(invoiceItems).values(
      input.items.map((it, i) => ({
        id: newId("itm"),
        invoiceId: id,
        currency: input.currency,
        description: it.description,
        qty: String(it.qty),
        unitPriceMinor: it.unitPriceMinor != null ? toNumericColumn(it.unitPriceMinor) : "0",
        position: i,
      })),
    );
  }

  await writeAudit({
    actor: input.actorId,
    action: "invoice.created",
    entityType: "invoices",
    entityId: id,
    after: { number: invoice.number, total: input.totalMinor, currency: input.currency, buyer: buyerName },
    aiRef: input.extractionId ?? undefined,
  });
  publish({ type: "invoice.updated", businessId: input.businessId, entityId: id, at: new Date().toISOString() });
  return invoice;
}

/** Create the Payaza payment link + move draft → ready. */
export async function finalizeInvoice(
  invoiceId: string,
  businessId: string,
): Promise<Invoice> {
  const inv = await mustGetInvoice(invoiceId, businessId);
  if (!["draft", "ready"].includes(inv.status)) {
    throw new Error(`cannot finalize invoice in status ${inv.status}`);
  }
  const biz = await mustGetBusiness(businessId);

  if (!inv.payazaLinkUrl) {
    // Payaza custom_url allows only /^[a-z0-9-]+$/ (max 60). Tokens look
    // like "tok_01…" — the underscore is illegal, so sanitize instead of
    // truncating (keeps full-token uniqueness; 35 chars total, well under).
    const slug = `ksn-${inv.token
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50)}`;
    const link = await createPaymentLink({
      payment_link_name: `Invoice ${inv.number}`,
      payment_description: `Invoice ${inv.number} — ${biz.name}`,
      has_fixed_amount: true,
      payment_amount: Number(inv.amountMinor) / 100, // wire = major units
      country_code: "KEN",
      currency_code: inv.currency,
      custom_url: slug,
      collect_customer_first_and_last_name: true,
      collect_customer_email: true,
      fee_bearer_type: inv.feeBearer === "customer" ? "Customer" : "Business",
      redirect_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/pay-done?ref=${encodeURIComponent(inv.token)}`,
    });
    await db
      .update(invoices)
      .set({
        payazaLinkId: String(link.data.id),
        payazaLinkUrl: link.data.link,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId));
  }

  if (inv.status === "draft") {
    assertInvoiceTransition(inv.status, "ready");
    await db.update(invoices).set({ status: "ready", updatedAt: new Date() }).where(eq(invoices.id, invoiceId));
  }
  const updated = await mustGetInvoice(invoiceId, businessId);
  publish({ type: "invoice.updated", businessId, entityId: invoiceId, at: new Date().toISOString() });
  return updated;
}

/** Send invoice to buyer: email (+SMS if phone) → status sent, schedule reminders. */
export async function sendInvoice(
  invoiceId: string,
  businessId: string,
  actorId: string,
  opts: { email?: boolean; sms?: boolean } = { email: true, sms: true },
): Promise<void> {
  const inv = await mustGetInvoice(invoiceId, businessId);
  if (!["ready", "sent", "partially_paid"].includes(inv.status)) {
    throw new Error(`invoice not sendable in status ${inv.status}`);
  }
  if (!inv.payazaLinkUrl) await finalizeInvoice(invoiceId, businessId);
  const fresh = inv.payazaLinkUrl ? inv : await mustGetInvoice(invoiceId, businessId);

  const [buyerRow] = await db.select().from(buyers).where(eq(buyers.id, fresh.buyerId)).limit(1);
  const biz = await mustGetBusiness(businessId);
  const payUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/i/${fresh.token}`;
  const amountDisplay = formatMinor(fresh.currency as CurrencyCode, Number(fresh.amountMinor));
  const dueDisplay = fresh.dueAt ? fresh.dueAt.toISOString().slice(0, 10) : "on receipt";

  if (opts.email && buyerRow?.email) {
    await sendEmail({
      to: buyerRow.email,
      subject: `Invoice ${fresh.number} from ${biz.name}`,
      html: invoiceEmail({
        buyerName: buyerRow.name.split(" ")[0]!,
        merchantName: biz.name,
        invoiceNumber: fresh.number,
        amountDisplay,
        dueDisplay,
        payUrl,
        paymentMethods: "USD card · Apple Pay · Google Pay · KES/UGX/TZS mobile money",
      }),
      tag: "invoice-sent",
    });
  }
  if (opts.sms && buyerRow?.phone) {
    await sendSms(
      buyerRow.phone,
      `KUSANYA: ${biz.name} sent invoice ${fresh.number} for ${amountDisplay}. Pay: ${payUrl}`,
    );
  }

  if (fresh.status === "ready") {
    assertInvoiceTransition("ready", "sent");
    await db
      .update(invoices)
      .set({ status: "sent", issuedAt: new Date(), updatedAt: new Date() })
      .where(eq(invoices.id, invoiceId));
    const { scheduleReminders } = await import("./reminders");
    await scheduleReminders(fresh.id, fresh.dueAt, amountDisplay, payUrl, fresh.number);
  }

  await writeAudit({
    actor: actorId,
    action: "invoice.sent",
    entityType: "invoices",
    entityId: invoiceId,
    after: { email: opts.email, sms: opts.sms },
  });
  publish({ type: "invoice.updated", businessId, entityId: invoiceId, at: new Date().toISOString() });
}

export async function cancelInvoice(invoiceId: string, businessId: string, actorId: string, reason: string) {
  const inv = await mustGetInvoice(invoiceId, businessId);
  assertInvoiceTransition(inv.status as never, "cancelled");
  await db.update(invoices).set({ status: "cancelled", updatedAt: new Date() }).where(eq(invoices.id, invoiceId));
  await writeAudit({ actor: actorId, action: "invoice.cancelled", entityType: "invoices", entityId: invoiceId, after: { reason } });
  publish({ type: "invoice.updated", businessId, entityId: invoiceId, at: new Date().toISOString() });
}

// -------------------------------------------------------------------- reads --

export interface InvoiceListFilter {
  status?: Invoice["status"][];
  q?: string;
  page?: number;
  pageSize?: number;
}

export async function listInvoices(businessId: string, filter: InvoiceListFilter = {}) {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, filter.pageSize ?? 25);
  const conditions = [eq(invoices.businessId, businessId)];
  if (filter.status?.length) conditions.push(inArray(invoices.status, filter.status));
  if (filter.q) {
    conditions.push(or(ilike(invoices.number, `%${filter.q}%`), ilike(buyers.name, `%${filter.q}%`))!);
  }
  const where = conditions.length === 1 ? conditions[0]! : and(...conditions)!;
  const rows = await db
    .select({
      invoice: invoices,
      buyerName: buyers.name,
      buyerCountry: buyers.country,
      paidMinor: sql<string>`coalesce(sum(case when ${transactions.kind} = 'collection' and ${transactions.status} = 'completed' then ${transactions.amountMinor} else 0 end), '0')`,
    })
    .from(invoices)
    .innerJoin(buyers, eq(buyers.id, invoices.buyerId))
    .leftJoin(transactions, eq(transactions.invoiceId, invoices.id))
    .where(where)
    .groupBy(invoices.id, buyers.name, buyers.country)
    .orderBy(desc(invoices.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(invoices)
    .innerJoin(buyers, eq(buyers.id, invoices.buyerId))
    .where(where);
  return { rows, total: Number(countRow?.n ?? 0), page, pageSize };
}

export async function getInvoiceDetail(businessId: string, invoiceId: string) {
  const invoice = await mustGetInvoice(invoiceId, businessId);
  const [buyer] = await db.select().from(buyers).where(eq(buyers.id, invoice.buyerId)).limit(1);
  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId))
    .orderBy(invoiceItems.position);
  const txns = await db
    .select()
    .from(transactions)
    .where(eq(transactions.invoiceId, invoiceId))
    .orderBy(desc(transactions.createdAt));
  const payoutRows = txns.length
    ? await db
        .select()
        .from(payouts)
        .where(inArray(payouts.transactionId, txns.map((t) => t.id)))
    : [];
  const [risk] = await db
    .select()
    .from(riskAssessments)
    .where(eq(riskAssessments.invoiceId, invoiceId))
    .orderBy(desc(riskAssessments.createdAt))
    .limit(1);
  const splits = await db
    .select({
      split: invoiceSplits,
      partnerName: splitBeneficiaries.name,
      partnerShare: splitBeneficiaries.splitValue,
    })
    .from(invoiceSplits)
    .innerJoin(splitBeneficiaries, eq(splitBeneficiaries.id, invoiceSplits.beneficiaryId))
    .where(eq(invoiceSplits.invoiceId, invoiceId));
  const rems = await db
    .select()
    .from(reminders)
    .where(eq(reminders.invoiceId, invoiceId))
    .orderBy(desc(reminders.scheduledAt));
  return { invoice, buyer, items, transactions: txns, payouts: payoutRows, risk, splits, reminders: rems };
}

/** Buyer-facing fetch by public token — no auth, minimal fields only. */
export async function getBuyerInvoice(token: string) {
  const [inv] = await db
    .select({
      id: invoices.id,
      businessId: invoices.businessId,
      number: invoices.number,
      token: invoices.token,
      status: invoices.status,
      currency: invoices.currency,
      amountMinor: invoices.amountMinor,
      dueAt: invoices.dueAt,
      notes: invoices.notes,
      createdAt: invoices.createdAt,
      payazaLinkUrl: invoices.payazaLinkUrl,
      feeBearer: invoices.feeBearer,
      buyerId: invoices.buyerId,
    })
    .from(invoices)
    .where(eq(invoices.token, token))
    .limit(1);
  if (!inv) return null;
  const [biz] = await db
    .select({ name: businesses.name, country: businesses.country })
    .from(businesses)
    .where(eq(businesses.id, inv.businessId))
    .limit(1);
  const [buyer] = await db
    .select({ name: buyers.name, kind: buyers.kind, country: buyers.country })
    .from(buyers)
    .where(eq(buyers.id, inv.buyerId))
    .limit(1);
  const items = await db
    .select({ description: invoiceItems.description, qty: invoiceItems.qty, unitPriceMinor: invoiceItems.unitPriceMinor })
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, inv.id))
    .orderBy(invoiceItems.position);
  const txns = await db
    .select({
      id: transactions.id,
      kind: transactions.kind,
      channel: transactions.channel,
      status: transactions.status,
      currency: transactions.currency,
      amountMinor: transactions.amountMinor,
      occurredAt: transactions.occurredAt,
      reference: transactions.merchantReference,
    })
    .from(transactions)
    .where(and(eq(transactions.invoiceId, inv.id), eq(transactions.kind, "collection")))
    .orderBy(desc(transactions.createdAt))
    .limit(5);
  return { invoice: inv, business: biz ?? null, buyer: buyer ?? null, items, transactions: txns };
}

// ------------------------------------------------------------------ helpers --

export async function mustGetInvoice(invoiceId: string, businessId: string): Promise<Invoice> {
  const rows = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.businessId, businessId)))
    .limit(1);
  if (!rows[0]) throw new Error("invoice not found"); // IDOR guard (build.md §12)
  return rows[0];
}

export async function mustGetBusiness(businessId: string): Promise<Business> {
  const rows = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!rows[0]) throw new Error("business not found");
  return rows[0];
}

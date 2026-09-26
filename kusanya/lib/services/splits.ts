import "server-only";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  invoiceSplits,
  invoices,
  splitBeneficiaries,
  type SplitBeneficiary,
} from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { toNumericColumn, formatMinor } from "@/lib/money/format";
import { createSplitAccount, personaErrorCopy } from "@/lib/payaza/endpoints";
import { writeAudit } from "@/lib/db/audit";
import { publish } from "./events";

/**
 * Partner splits (Track #04 agency model + solution §8): agents/freight/
 * brokers get paid automatically from each collection via Payaza split
 * accounts (SSA codes ride in the Checkout SDK).
 *
 * ⚠️ Payaza split_value INVERSION: the API field is what the PLATFORM KEEPS,
 * so we store splitValue = 100 − partner share. The UI always speaks in
 * PARTNER SHARE (sharePct = 100 − splitValue).
 */

export interface CreatePartnerInput {
  businessId: string;
  actorId: string;
  name: string;
  email: string;
  accountNo: string;
  accountName: string;
  bankCode: string;
  sharePct: number; // partner's share, 0 < pct < 100
  rail?: "mpesa" | "bank";
}

export async function createPartner(input: CreatePartnerInput): Promise<SplitBeneficiary> {
  if (input.sharePct <= 0 || input.sharePct >= 100) {
    throw new Error("Partner share must be between 0 and 100 percent.");
  }
  let resp;
  try {
    resp = await createSplitAccount({
      account_no: input.accountNo,
      account_name: input.accountName,
      bank_code: input.bankCode,
      name: input.name,
      email: input.email,
      currency: "KES", // MVP beneficiaries settle in KES
      country: "KEN",
      split_type: "PERCENTAGE",
      split_value: 100 - input.sharePct, // INVERTED: platform/merchant keep
    });
  } catch (err) {
    throw new Error(personaErrorCopy(err));
  }

  const id = newId("spb");
  const [row] = await db
    .insert(splitBeneficiaries)
    .values({
      id,
      businessId: input.businessId,
      name: input.name,
      email: input.email,
      accountNo: input.accountNo,
      bankCode: input.bankCode,
      rail: input.rail ?? "mpesa",
      splitType: "PERCENTAGE",
      splitValue: String(100 - input.sharePct), // INVERTED platform-keep value
      payazaSplitCode: resp.data.code,
      payazaSplitId: String(resp.data.id),
      active: true,
    })
    .returning();

  await writeAudit({
    actor: input.actorId,
    action: "partner.created",
    entityType: "split_beneficiaries",
    entityId: id,
    after: { name: input.name, sharePct: input.sharePct, ssa: resp.data.code },
  });
  publish({ type: "invoice.updated", businessId: input.businessId, at: new Date().toISOString() });
  return row;
}

export interface PartnerView extends SplitBeneficiary {
  sharePct: number; // derived: 100 − splitValue
}

export async function listPartners(businessId: string): Promise<PartnerView[]> {
  const rows = await db
    .select()
    .from(splitBeneficiaries)
    .where(and(eq(splitBeneficiaries.businessId, businessId), eq(splitBeneficiaries.active, true)))
    .orderBy(desc(splitBeneficiaries.createdAt));
  return rows.map((r) => ({ ...r, sharePct: 100 - Number(r.splitValue) }));
}

export async function deactivatePartner(partnerId: string, businessId: string, actorId: string) {
  const [row] = await db
    .select()
    .from(splitBeneficiaries)
    .where(and(eq(splitBeneficiaries.id, partnerId), eq(splitBeneficiaries.businessId, businessId)))
    .limit(1);
  if (!row) throw new Error("partner not found");
  // Live: also delete on Payaza via payazaSplitId (best effort — kept for audit).
  await db.update(splitBeneficiaries).set({ active: false }).where(eq(splitBeneficiaries.id, partnerId));
  await writeAudit({ actor: actorId, action: "partner.deactivated", entityType: "split_beneficiaries", entityId: partnerId, before: { name: row.name } });
}

/** Attach split allocations to an invoice (shares must sum ≤ 100). */
export async function attachInvoiceSplits(
  invoiceId: string,
  businessId: string,
  allocations: { partnerId: string; sharePct: number }[],
) {
  const total = allocations.reduce((s, a) => s + a.sharePct, 0);
  if (total > 100) throw new Error(`Split shares sum to ${total}% — must be ≤ 100%.`);
  const [inv] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.businessId, businessId)))
    .limit(1);
  if (!inv) throw new Error("invoice not found");
  if (["paid", "settling", "settled", "paying_out", "completed"].includes(inv.status)) {
    throw new Error("Splits can't be changed after payment starts.");
  }
  const existing = await db.select({ id: invoiceSplits.id }).from(invoiceSplits).where(eq(invoiceSplits.invoiceId, invoiceId));
  if (existing.length) {
    await db.delete(invoiceSplits).where(eq(invoiceSplits.invoiceId, invoiceId));
  }
  const gross = Number(inv.amountMinor);
  const rows = allocations.map((a) => ({
    id: newId("isp"),
    invoiceId,
    beneficiaryId: a.partnerId,
    sharePct: String(a.sharePct),
    expectedAmountMinor: toNumericColumn(Math.round((gross * a.sharePct) / 100)),
  }));
  if (rows.length) await db.insert(invoiceSplits).values(rows);
  await writeAudit({
    actor: "merchant",
    action: "invoice.splits_attached",
    entityType: "invoices",
    entityId: invoiceId,
    after: { allocations },
  });
  return rows;
}

/** Partner statement — settled split amounts over a period. */
export async function partnerStatement(businessId: string, partnerId: string, from: Date, to: Date) {
  const [partner] = await db
    .select()
    .from(splitBeneficiaries)
    .where(and(eq(splitBeneficiaries.id, partnerId), eq(splitBeneficiaries.businessId, businessId)))
    .limit(1);
  if (!partner) throw new Error("partner not found");

  const rows = await db
    .select({
      invoiceNumber: invoices.number,
      invoiceStatus: invoices.status,
      sharePct: invoiceSplits.sharePct,
      expected: invoiceSplits.expectedAmountMinor,
      settled: invoiceSplits.settledAmountMinor,
      updatedAt: invoices.updatedAt,
    })
    .from(invoiceSplits)
    .innerJoin(invoices, eq(invoices.id, invoiceSplits.invoiceId))
    .where(and(eq(invoiceSplits.beneficiaryId, partnerId), gte(invoices.createdAt, from), lte(invoices.createdAt, to)))
    .orderBy(desc(invoices.createdAt));

  const settledTotalMinor = rows.reduce((s, r) => s + Number(r.settled ?? 0), 0);
  const expectedTotalMinor = rows.reduce((s, r) => s + Number(r.expected ?? 0), 0);

  return {
    partner: { ...partner, sharePct: 100 - Number(partner.splitValue) },
    rows: rows.map((r) => ({
      invoiceNumber: r.invoiceNumber,
      invoiceStatus: r.invoiceStatus,
      sharePct: Number(r.sharePct ?? 0),
      expectedDisplay: formatMinor("KES", Number(r.expected ?? 0)),
      settledDisplay: r.settled ? formatMinor("KES", Number(r.settled)) : null,
      updatedAt: r.updatedAt,
    })),
    settledTotalDisplay: formatMinor("KES", settledTotalMinor),
    expectedTotalDisplay: formatMinor("KES", expectedTotalMinor),
  };
}

/** When a collection completes, record settled split amounts. */
export async function markSplitsSettled(invoiceId: string, collectedMinor: number) {
  const rows = await db.select().from(invoiceSplits).where(eq(invoiceSplits.invoiceId, invoiceId));
  for (const row of rows) {
    const settled = Math.round((collectedMinor * Number(row.sharePct ?? 0)) / 100);
    await db
      .update(invoiceSplits)
      .set({ settledAmountMinor: toNumericColumn(settled) })
      .where(eq(invoiceSplits.id, row.id));
  }
  return rows.length;
}

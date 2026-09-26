"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/config";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { aiExtractions } from "@/lib/db/schema";
import {
  createInvoice,
  finalizeInvoice,
  sendInvoice,
  cancelInvoice,
  mustGetInvoice,
} from "@/lib/services/invoices";
import { screenInvoice } from "@/lib/services/risk";
import { loadBuyerHistory } from "@/lib/services/extraction";
import { simulateSettlement } from "@/lib/services/payouts";
import { createInvoiceSchema, type CreateInvoiceInput } from "@/lib/validators/invoice";
import type { ActionResult } from "./auth";

/**
 * Invoice server actions (merchant forms). Pipeline for the wizard:
 * create (draft) → risk screen → pass: finalize (payment link) + send;
 * review/hold: stop and surface the review queue.
 *
 * NOTE: the zod schema lives in @/lib/validators/invoice — "use server"
 * modules may only export async functions (Next build enforces this).
 */

async function sessionContext() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const { businesses } = await import("@/lib/db/schema");
  const rows = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.userId, session.user.id)).limit(1);
  if (!rows[0]) return null;
  return { userId: session.user.id, businessId: rows[0].id };
}

export async function createInvoiceAction(
  input: CreateInvoiceInput,
): Promise<ActionResult<{ invoiceId: string; status: string; riskDecision: string; riskScore: number }>> {
  const ctx = await sessionContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  const parsed = createInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the invoice fields." };
  }
  const data = parsed.data;

  try {
    // Sum check when items carry prices (transparency, not a hard block).
    const invoice = await createInvoice({
      businessId: ctx.businessId,
      actorId: ctx.userId,
      buyer:
        "existingId" in data.buyer
          ? { existingId: data.buyer.existingId }
          : {
              name: data.buyer.name,
              kind: data.buyer.kind,
              country: data.buyer.country,
              email: data.buyer.email || null,
              phone: data.buyer.phone || null,
            },
      items: data.items.map((i) => ({
        description: i.description,
        qty: i.qty,
        unitPriceMinor: i.unitPriceMinor,
      })),
      totalMinor: data.totalMinor,
      currency: data.currency,
      dueAt: data.dueAt ?? null,
      notes: data.notes ?? null,
      feeBearer: data.feeBearer,
      extractionId: data.extractionId ?? null,
    });

    // Risk screening — source text from the extraction when present.
    let sourceText: string | null = null;
    if (data.extractionId) {
      const [ext] = await db.select().from(aiExtractions).where(eq(aiExtractions.id, data.extractionId)).limit(1);
      sourceText = ext?.sourceText ?? null;
    }
    const buyerForRisk =
      "existingId" in data.buyer
        ? { id: data.buyer.existingId, name: "", country: "KE" }
        : { id: invoice.buyerId, name: data.buyer.name, country: data.buyer.country };
    const { buyers } = await import("@/lib/db/schema");
    const [buyerRow] = await db.select().from(buyers).where(eq(buyers.id, invoice.buyerId)).limit(1);
    const history = await loadBuyerHistory(ctx.businessId, invoice.buyerId);
    const { result } = await screenInvoice({
      invoice: { id: invoice.id, status: invoice.status },
      text: sourceText,
      buyerName: buyerRow?.name ?? buyerForRisk.name,
      buyerCountry: buyerRow?.country ?? buyerForRisk.country,
      isFirstBuyer: history.isFirstBuyer,
      invoiceTotalMinor: data.totalMinor,
      historyAverageMinor: history.averageMinor,
    });

    let status = invoice.status;
    if (result.decision === "pass" && data.sendNow) {
      await finalizeInvoice(invoice.id, ctx.businessId);
      await sendInvoice(invoice.id, ctx.businessId, ctx.userId);
      status = "sent";
    } else if (result.decision === "pass") {
      await finalizeInvoice(invoice.id, ctx.businessId);
      status = "ready";
    }
    revalidatePath("/app/invoices");
    return {
      ok: true,
      data: { invoiceId: invoice.id, status, riskDecision: result.decision, riskScore: result.score },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not create the invoice." };
  }
}

export async function sendInvoiceAction(invoiceId: string): Promise<ActionResult> {
  const ctx = await sessionContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  try {
    await sendInvoice(invoiceId, ctx.businessId, ctx.userId);
    revalidatePath(`/app/invoices/${invoiceId}`);
    revalidatePath("/app/invoices");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not send." };
  }
}

export async function cancelInvoiceAction(invoiceId: string, reason: string): Promise<ActionResult> {
  const ctx = await sessionContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  try {
    await cancelInvoice(invoiceId, ctx.businessId, ctx.userId, reason);
    revalidatePath("/app/invoices");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not cancel." };
  }
}

export async function simulateSettlementAction(invoiceId: string): Promise<ActionResult> {
  const ctx = await sessionContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  try {
    await simulateSettlement(invoiceId, ctx.businessId);
    revalidatePath(`/app/invoices/${invoiceId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not settle." };
  }
}

/** Resend link (buyer asked again) — same as send but always allowed on sent. */
export async function resendInvoiceAction(invoiceId: string): Promise<ActionResult> {
  const ctx = await sessionContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  try {
    const inv = await mustGetInvoice(invoiceId, ctx.businessId);
    if (inv.status !== "sent") return { ok: false, error: "Only sent invoices can be resent." };
    await sendInvoice(invoiceId, ctx.businessId, ctx.userId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not resend." };
  }
}

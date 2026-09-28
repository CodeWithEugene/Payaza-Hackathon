"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/config";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sendInvoice, cancelInvoice, mustGetInvoice } from "@/lib/services/invoices";
import { issueInvoice } from "@/lib/services/invoice-pipeline";
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
    const { invoice, riskDecision, riskScore } = await issueInvoice({
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
      sendNow: data.sendNow,
    });
    revalidatePath("/app/invoices");
    return {
      ok: true,
      data: { invoiceId: invoice.id, status: invoice.status, riskDecision, riskScore },
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

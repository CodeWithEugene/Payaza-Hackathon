"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { auth } from "@/lib/auth/config";
import { headers } from "next/headers";
import { db } from "@/lib/db/client";
import { businesses, payoutRails } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { initiateInvoicePayout } from "@/lib/services/payouts";
import { createPartner, deactivatePartner, attachInvoiceSplits } from "@/lib/services/splits";
import { writeAudit } from "@/lib/db/audit";
import type { ActionResult } from "./auth";

async function sessionContext() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const rows = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.userId, session.user.id)).limit(1);
  if (!rows[0]) return null;
  return { userId: session.user.id, businessId: rows[0].id };
}

// ------------------------------------------------------------------ payouts --

export async function initiatePayoutAction(
  invoiceId: string,
  railId: string,
): Promise<ActionResult<{ payoutId: string; amountDisplay: string }>> {
  const ctx = await sessionContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  try {
    const result = await initiateInvoicePayout({
      invoiceId,
      businessId: ctx.businessId,
      railId,
      actorId: ctx.userId,
    });
    revalidatePath(`/app/invoices/${invoiceId}`);
    revalidatePath("/app/payments");
    return { ok: true, data: { payoutId: result.payoutId, amountDisplay: result.amountDisplay } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Payout failed." };
  }
}

// ------------------------------------------------------------------- rails ---

const railSchema = z.object({
  rail: z.enum(["mpesa", "kepss_bank"]),
  phone: z.string().regex(/^\+?254\d{9}$/, "Enter a valid M-Pesa number (07XX…)").optional().or(z.literal("")),
  accountNumber: z.string().min(4).max(32).optional().or(z.literal("")),
  accountName: z.string().min(2).max(160),
  bankCode: z.string().min(2).max(16).optional().or(z.literal("")),
  isDefault: z.boolean().default(false),
});

export async function saveRailAction(
  input: z.input<typeof railSchema> & { railId?: string },
): Promise<ActionResult<{ railId: string }>> {
  const ctx = await sessionContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  const parsed = railSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the rail fields." };
  const d = parsed.data;
  if (d.rail === "mpesa" && !d.phone) return { ok: false, error: "M-Pesa rail needs a phone number." };
  if (d.rail === "kepss_bank" && (!d.accountNumber || !d.bankCode)) {
    return { ok: false, error: "Bank rail needs an account number and bank code." };
  }
  const phone = d.phone ? d.phone.replace(/\D/g, "").replace(/^0/, "254") : null;

  try {
    if (input.railId) {
      const [existing] = await db
        .select()
        .from(payoutRails)
        .where(and(eq(payoutRails.id, input.railId), eq(payoutRails.businessId, ctx.businessId)))
        .limit(1);
      if (!existing) return { ok: false, error: "Rail not found." };
      await db
        .update(payoutRails)
        .set({
          rail: d.rail,
          phone,
          accountNumber: d.accountNumber || null,
          accountName: d.accountName,
          bankCode: d.bankCode || null,
          isDefault: d.isDefault,
        })
        .where(eq(payoutRails.id, input.railId));
      if (d.isDefault) await clearOtherDefaults(ctx.businessId, input.railId);
      revalidatePath("/app/settings");
      return { ok: true, data: { railId: input.railId } };
    }
    const railId = newId("rail");
    await db.insert(payoutRails).values({
      id: railId,
      businessId: ctx.businessId,
      rail: d.rail,
      phone,
      accountNumber: d.accountNumber || null,
      accountName: d.accountName,
      bankCode: d.bankCode || null,
      isDefault: d.isDefault,
    });
    if (d.isDefault) await clearOtherDefaults(ctx.businessId, railId);
    await writeAudit({ actor: ctx.userId, action: "rail.created", entityType: "payout_rails", entityId: railId, after: { rail: d.rail } });
    revalidatePath("/app/settings");
    return { ok: true, data: { railId } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save rail." };
  }
}

async function clearOtherDefaults(businessId: string, keepId: string) {
  await db
    .update(payoutRails)
    .set({ isDefault: false })
    .where(and(eq(payoutRails.businessId, businessId), ne(payoutRails.id, keepId)));
}

// ----------------------------------------------------------------- partners --

const partnerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  accountNo: z.string().min(4).max(40),
  accountName: z.string().min(2).max(160),
  bankCode: z.string().min(2).max(16),
  sharePct: z.number().min(0.5).max(99.5),
});

export async function createPartnerAction(
  input: z.input<typeof partnerSchema>,
): Promise<ActionResult<{ partnerId: string }>> {
  const ctx = await sessionContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  const parsed = partnerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the partner fields." };
  try {
    const row = await createPartner({
      businessId: ctx.businessId,
      actorId: ctx.userId,
      ...parsed.data,
    });
    revalidatePath("/app/partners");
    return { ok: true, data: { partnerId: row.id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not add partner." };
  }
}

export async function deactivatePartnerAction(partnerId: string): Promise<ActionResult> {
  const ctx = await sessionContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  try {
    await deactivatePartner(partnerId, ctx.businessId, ctx.userId);
    revalidatePath("/app/partners");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not deactivate partner." };
  }
}

export async function attachSplitsAction(
  invoiceId: string,
  allocations: { partnerId: string; sharePct: number }[],
): Promise<ActionResult> {
  const ctx = await sessionContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  try {
    await attachInvoiceSplits(invoiceId, ctx.businessId, allocations);
    revalidatePath(`/app/invoices/${invoiceId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not attach splits." };
  }
}

// ----------------------------------------------------------------- settings --

export async function updateSettingsAction(
  settings: Record<string, unknown>,
): Promise<ActionResult> {
  const ctx = await sessionContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  try {
    const [biz] = await db.select().from(businesses).where(eq(businesses.id, ctx.businessId)).limit(1);
    const merged = { ...(biz.settings as Record<string, unknown>), ...settings };
    await db.update(businesses).set({ settings: merged }).where(eq(businesses.id, ctx.businessId));
    await writeAudit({ actor: ctx.userId, action: "business.settings_updated", entityType: "businesses", entityId: ctx.businessId, after: settings });
    revalidatePath("/app/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save settings." };
  }
}

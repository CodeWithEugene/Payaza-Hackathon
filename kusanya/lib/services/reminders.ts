import "server-only";
import { and, desc, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { buyers, invoices, reminders, transactions } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { formatMinor } from "@/lib/money/format";
import type { CurrencyCode } from "@/lib/money/currencies";
import { checkReminderDraft, type LedgerFact } from "@/lib/jev/guardrails";
import { classifyBuyerMessage } from "@/lib/jev/intent";
import { writeAudit } from "@/lib/db/audit";
import { publish } from "./events";
import { getOwnerContact } from "./business";
import { sendEmail } from "@/lib/notify/email";
import { sendSms } from "@/lib/notify/sms";
import { reminderEmail } from "@/lib/notify/templates";
import type { BuyerIntent } from "@/lib/jev/types";

/**
 * Gentle dunning engine (solution §10): template reminders at D-3, D0, D+2,
 * D+7 — each GUARDRAIL-CHECKED against ledger facts before sending, merchant-
 * editable, never sent when blocked. Buyer replies are intent-routed;
 * low-confidence intents surface the raw message (never auto-act).
 *
 * NOTE: reminders table has no businessId — scope checks join through
 * invoices (every query here is scoped by invoiceId).
 */

const OFFSETS_DAYS = [-3, 0, 2, 7];

export async function scheduleReminders(
  invoiceId: string,
  dueAt: Date | null,
  amountDisplay: string,
  payUrl: string,
  invoiceNumber: string,
): Promise<number> {
  if (!dueAt) return 0; // no due date → no dunning (pay-on-receipt invoices)
  const now = Date.now();
  const rows = OFFSETS_DAYS.map((offset) => {
    const at = new Date(dueAt);
    at.setUTCDate(at.getUTCDate() + offset);
    at.setUTCHours(9, 0, 0, 0); // 09:00 UTC = 12:00 EAT — polite hour
    return { offset, at };
  })
    .filter(({ at }) => at.getTime() > now)
    .map(({ offset, at }) => ({
      id: newId("rem"),
      invoiceId,
      channel: "email" as const,
      body: templateBody(offset, invoiceNumber, amountDisplay, dueAt, payUrl),
      scheduledAt: at,
      draftedBy: "template" as const,
      status: "scheduled" as const,
    }));
  if (rows.length) await db.insert(reminders).values(rows);
  return rows.length;
}

function templateBody(
  offset: number,
  invoiceNumber: string,
  amountDisplay: string,
  dueAt: Date,
  payUrl: string,
): string {
  const due = dueAt.toISOString().slice(0, 10);
  if (offset < 0)
    return `Hi! A quick heads-up: invoice ${invoiceNumber} for ${amountDisplay} is due on ${due}. Pay in ~2 minutes: ${payUrl}`;
  if (offset === 0)
    return `Hi! Invoice ${invoiceNumber} for ${amountDisplay} is due today (${due}). Pay here: ${payUrl} — if you've already paid, thank you!`;
  return `Hi! Invoice ${invoiceNumber} for ${amountDisplay} was due on ${due} and is still open. You can settle it here: ${payUrl}. If something's not right, just reply — we'll sort it out.`;
}

/** Scoped reminder fetch (business check via invoice ownership). */
async function mustGetReminder(reminderId: string, businessId: string) {
  const rows = await db
    .select({ reminder: reminders, invoice: invoices })
    .from(reminders)
    .innerJoin(invoices, eq(invoices.id, reminders.invoiceId))
    .where(and(eq(reminders.id, reminderId), eq(invoices.businessId, businessId)))
    .limit(1);
  if (!rows[0]) throw new Error("reminder not found");
  return rows[0];
}

/** Draft now + guardrail-check (AI drafts, human sends — build.md §7). */
export async function draftReminder(reminderId: string, businessId: string, bodyOverride?: string) {
  const { reminder: rem } = await mustGetReminder(reminderId, businessId);
  const body = bodyOverride ?? rem.body ?? "";
  const facts = await ledgerFacts(rem.invoiceId);
  const guard = await checkReminderDraft(body, facts);
  await db
    .update(reminders)
    .set({
      body,
      status: "draft",
      draftedBy: bodyOverride ? "ai" : rem.draftedBy,
      guardrail: guard as unknown as Record<string, unknown>,
    })
    .where(eq(reminders.id, reminderId));
  await writeAudit({
    actor: guard.source === "jev" ? "jev" : "system",
    action: "reminder.drafted",
    entityType: "reminders",
    entityId: reminderId,
    after: { blocked: guard.blocked, unsafeP: guard.unsafeProbability, claims: guard.claims.length },
  });
  publish({ type: "reminder.updated", businessId, entityId: reminderId, at: new Date().toISOString() });
  return guard;
}

/** Merchant approves/send. Blocked drafts refuse to send (guardrail law). */
export async function sendReminder(reminderId: string, businessId: string, actorId: string) {
  const { reminder: rem, invoice: inv } = await mustGetReminder(reminderId, businessId);
  const guard = rem.guardrail as unknown as { blocked?: boolean } | null;
  if (guard?.blocked) {
    throw new Error("This draft was blocked by the guardrail (unsupported or unsafe claims). Edit it and re-check.");
  }
  if (["paid", "completed", "settled", "settling", "paying_out", "cancelled", "partially_paid"].includes(inv.status)) {
    await db.update(reminders).set({ status: "cancelled" }).where(eq(reminders.id, reminderId));
    return { skipped: true as const, reason: "invoice no longer open" };
  }
  const [buyer] = await db.select().from(buyers).where(eq(buyers.id, inv.buyerId)).limit(1);
  if (!buyer) throw new Error("buyer missing");
  const owner = await getOwnerContact(businessId);
  const amountDisplay = formatMinor(inv.currency as CurrencyCode, Number(inv.amountMinor));
  const payUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/i/${inv.token}`;

  if (rem.channel === "email" && buyer.email) {
    await sendEmail({
      to: buyer.email,
      subject: `Reminder: invoice ${inv.number}`,
      html: reminderEmail({
        buyerName: buyer.name.split(" ")[0]!,
        invoiceNumber: inv.number,
        amountDisplay,
        dueDisplay: inv.dueAt?.toISOString().slice(0, 10) ?? "soon",
        payUrl,
        merchantName: owner?.business.name ?? "the merchant",
      }),
      tag: "reminder",
    });
  } else if (buyer.phone) {
    await sendSms(buyer.phone, `KUSANYA: ${rem.body}`);
  }
  await db.update(reminders).set({ status: "sent", sentAt: new Date() }).where(eq(reminders.id, reminderId));
  await writeAudit({ actor: actorId, action: "reminder.sent", entityType: "reminders", entityId: reminderId, after: { channel: rem.channel } });
  publish({ type: "reminder.updated", businessId, entityId: reminderId, at: new Date().toISOString() });
  return { skipped: false as const };
}

/** Cron: send due template reminders (guardrail-checked first). */
export async function runDueReminders(limit = 25) {
  const due = await db
    .select({ reminder: reminders, businessId: invoices.businessId })
    .from(reminders)
    .innerJoin(invoices, eq(invoices.id, reminders.invoiceId))
    .where(and(eq(reminders.status, "scheduled"), lte(reminders.scheduledAt, new Date())))
    .limit(limit);
  let sent = 0;
  for (const { reminder: rem, businessId } of due) {
    try {
      const guard = await draftReminder(rem.id, businessId);
      if (!guard.blocked) {
        const r = await sendReminder(rem.id, businessId, "system:cron");
        if (!r.skipped) sent++;
      }
    } catch (err) {
      console.warn("[reminders] failed:", rem.id, err);
    }
  }
  return { due: due.length, sent };
}

/** Buyer reply intake — intent routing (build.md §7). */
export async function processBuyerReply(opts: {
  invoiceId: string;
  businessId: string;
  message: string;
  channel: "email" | "sms" | "whatsapp";
}): Promise<{ intent: BuyerIntent; reliable: boolean; action: string }> {
  const [inv] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, opts.invoiceId), eq(invoices.businessId, opts.businessId)))
    .limit(1);
  if (!inv) throw new Error("invoice not found");
  const result = await classifyBuyerMessage(opts.message, {
    invoiceNumber: inv.number,
    status: inv.status,
    dueAt: inv.dueAt?.toISOString() ?? null,
  });

  let action = "surfaced_to_merchant";
  if (result.reliable && result.intent === "promise_to_pay") {
    // Pause dunning: push scheduled reminders out by 3 days.
    const upcoming = await db
      .select()
      .from(reminders)
      .where(and(eq(reminders.invoiceId, opts.invoiceId), eq(reminders.status, "scheduled")))
      .limit(10);
    for (const r of upcoming) {
      const at = new Date(r.scheduledAt ?? new Date());
      at.setUTCDate(at.getUTCDate() + 3);
      await db.update(reminders).set({ scheduledAt: at }).where(eq(reminders.id, r.id));
    }
    action = `dunning_paused_3d (${upcoming.length} reminders)`;
  } else if (result.reliable && result.intent === "dispute") {
    const upcoming = await db
      .select({ id: reminders.id })
      .from(reminders)
      .where(and(eq(reminders.invoiceId, opts.invoiceId), eq(reminders.status, "scheduled")));
    if (upcoming.length) {
      await db
        .update(reminders)
        .set({ status: "cancelled" })
        .where(inArray(reminders.id, upcoming.map((u) => u.id)));
    }
    action = `dispute_flagged (${upcoming.length} reminders cancelled)`;
  } else if (result.reliable && result.intent === "spam") {
    action = "ignored_spam";
  }

  const owner = await getOwnerContact(opts.businessId);
  if (owner?.email && (result.intent === "dispute" || !result.reliable)) {
    await sendEmail({
      to: owner.email,
      subject: result.reliable ? `Buyer dispute on ${inv.number}` : `Buyer reply needs your eyes — ${inv.number}`,
      html: `<p>Buyer replied on invoice <strong>${inv.number}</strong>.</p><p>Detected intent: <strong>${result.intent}</strong> (confidence ${(result.confidence * 100).toFixed(0)}%${result.reliable ? "" : " — LOW, showing raw message"})</p><blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#444">${escapeHtml(opts.message.slice(0, 2000))}</blockquote>`,
      tag: "buyer-reply",
    });
  }

  await writeAudit({
    actor: result.source === "jev" ? "jev" : "system",
    action: "reminder.reply_routed",
    entityType: "invoices",
    entityId: opts.invoiceId,
    after: { intent: result.intent, confidence: result.confidence, reliable: result.reliable, action, channel: opts.channel },
  });
  publish({ type: "invoice.updated", businessId: opts.businessId, entityId: opts.invoiceId, at: new Date().toISOString() });
  return { intent: result.intent, reliable: result.reliable, action };
}

export async function listReminders(invoiceId: string) {
  return db.select().from(reminders).where(eq(reminders.invoiceId, invoiceId)).orderBy(desc(reminders.scheduledAt));
}

/** Ledger facts for guardrail citation checks — numbers/dates that exist. */
async function ledgerFacts(invoiceId: string): Promise<LedgerFact[]> {
  const [inv] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!inv) return [];
  const facts: LedgerFact[] = [
    { fact: `Invoice ${inv.number} is for ${formatMinor(inv.currency as CurrencyCode, Number(inv.amountMinor))}` },
  ];
  if (inv.dueAt) facts.push({ fact: `Invoice ${inv.number} is due on ${inv.dueAt.toISOString().slice(0, 10)}` });
  const paid = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.invoiceId, invoiceId), eq(transactions.kind, "collection"), eq(transactions.status, "completed")));
  for (const t of paid) {
    facts.push({
      fact: `A payment of ${formatMinor(t.currency as CurrencyCode, Number(t.amountMinor))} was received on ${(t.occurredAt ?? t.createdAt).toISOString().slice(0, 10)}`,
    });
  }
  return facts;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

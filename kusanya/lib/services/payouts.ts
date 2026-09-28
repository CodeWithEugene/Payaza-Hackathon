import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  invoices,
  payoutRails,
  payouts,
  transactions,
  webhookEvents,
  type Invoice,
  type Payout,
  type PayoutRail,
  type Transaction,
} from "@/lib/db/schema";
import { newId, newMerchantReference } from "@/lib/ids";
import { toNumericColumn, minorToMajor, formatMinor } from "@/lib/money/format";
import { accountEnquiry, initiatePayout } from "@/lib/payaza/endpoints";
import {
  assertTxnTransition,
  assertInvoiceTransition,
  payoutRawToTxnStatus,
  invoiceStatusAfterPayout,
  type TxnStatus,
} from "@/lib/payaza/state-machine";
import { writeAudit } from "@/lib/db/audit";
import { publish } from "./events";
import { invoiceWaterfall } from "./waterfall";
import { mustGetBusiness, mustGetInvoice } from "./invoices";
import { getOwnerContact } from "./business";
import { sendEmail } from "@/lib/notify/email";
import { payoutSentEmail, payoutFailedEmail } from "@/lib/notify/templates";
import { sendSms } from "@/lib/notify/sms";
import { env } from "@/lib/config/env";
import { settlementEta } from "@/lib/money/fx";
import type { CurrencyCode } from "@/lib/money/currencies";
import { runInBackground } from "@/lib/runtime/background";

/** Simulated Payaza transfer webhook lands this long after the payout starts. */
const DEMO_SETTLEMENT_DELAY_MS = 1_500;

/**
 * Payout service — KES to M-Pesa / kepss (build.md §6.4).
 * Single completion path (applyPayoutResult) shared by webhook + demo replay.
 * The live payout PIN is injected in endpoints.ts from env — never stored,
 * never client-sent (security §12).
 */

// ------------------------------------------------------------ wallet cache --

interface WalletCache {
  at: number;
  data: Awaited<ReturnType<typeof accountEnquiry>>;
}
const walletCache = new Map<string, WalletCache>();

export async function getWallets(businessId: string, force = false) {
  const hit = walletCache.get(businessId);
  if (!force && hit && Date.now() - hit.at < 60_000) return hit.data;
  const data = await accountEnquiry();
  walletCache.set(businessId, { at: Date.now(), data });
  return data;
}

export async function getWalletForCurrency(businessId: string, currency: string) {
  const wallets = await getWallets(businessId);
  return wallets.data.find((w) => w.currency === currency && w.status === "ACTIVE") ?? null;
}

// ------------------------------------------------------------ initiate ------

export interface InitiatePayoutInput {
  invoiceId: string;
  businessId: string;
  railId: string;
  actorId: string;
}

export async function initiateInvoicePayout(input: InitiatePayoutInput) {
  const inv = await mustGetInvoice(input.invoiceId, input.businessId);
  const biz = await mustGetBusiness(input.businessId);

  if (inv.status === "paid") {
    // Local-rail collections settle T+1; the MVP advances paid → settled with
    // an explicit audit entry (demo "simulate settlement" does the same;
    // live USD waits for real settlement before payout unlocks).
    await advanceSettlement(inv, input.actorId, "local-rail T+1 auto-advance");
  }
  if (inv.status !== "settled") {
    const eta = settlementEta(inv.currency as CurrencyCode);
    throw new Error(
      `This invoice isn't settled yet. Payaza settles ${inv.currency} in ${eta.label}. Payout unlocks the moment funds land in your wallet.`,
    );
  }

  const [rail] = await db
    .select()
    .from(payoutRails)
    .where(and(eq(payoutRails.id, input.railId), eq(payoutRails.businessId, input.businessId)))
    .limit(1);
  if (!rail) throw new Error("Payout rail not found. Add your M-Pesa or bank details in Settings.");

  const wf = await invoiceWaterfall(inv);
  if (wf.netCurrency !== "KES") throw new Error("Waterfall did not resolve to KES. Contact support.");
  const payoutMinor = wf.netMinor;
  if (payoutMinor <= 0) throw new Error("Nothing left to pay out after fees and splits.");

  const wallet = await getWalletForCurrency(input.businessId, "KES");
  if (!wallet) throw new Error("No active KES wallet found on your Payaza account.");
  if (wallet.postNoDebit) {
    throw new Error("Payouts are temporarily frozen on your wallet (PND flag). Contact Payaza support.");
  }

  // Idempotent: if a payout is already awaiting confirmation for this
  // invoice, hand it back instead of creating a duplicate (the dialog can
  // be reopened safely after an abandoned attempt).
  const [awaiting] = await db
    .select({ payoutId: payouts.id, txnId: transactions.id })
    .from(payouts)
    .innerJoin(transactions, eq(transactions.id, payouts.transactionId))
    .where(
      and(
        eq(transactions.invoiceId, inv.id),
        eq(transactions.kind, "payout"),
        eq(payouts.status, "initialized"),
      ),
    )
    .limit(1);
  if (awaiting) {
    return {
      txnId: awaiting.txnId,
      payoutId: awaiting.payoutId,
      status: "awaiting_confirmation" as const,
      amountDisplay: formatMinor("KES", payoutMinor),
      message: `Payout of ${formatMinor("KES", payoutMinor)} is waiting for your confirmation code.`,
    };
  }

  const txnId = newId("txn");
  const payoutId = newId("pay");
  const merchantReference = newMerchantReference();
  const isMpesa = rail.rail === "mpesa";
  const channel: Transaction["channel"] = isMpesa ? "mpesa_payout" : "kepss_payout";
  const accountNumber = isMpesa ? rail.phone : rail.accountNumber;
  if (!accountNumber) throw new Error("Payout rail is missing its account/phone number.");
  const accountName = rail.accountName || biz.name;

  await db.insert(transactions).values({
    id: txnId,
    businessId: input.businessId,
    invoiceId: inv.id,
    merchantReference,
    kind: "payout",
    direction: "out",
    channel,
    currency: "KES",
    amountMinor: toNumericColumn(payoutMinor),
    status: "initialized",
    occurredAt: new Date(),
  });
  await db.insert(payouts).values({
    id: payoutId,
    transactionId: txnId,
    railId: rail.id,
    beneficiaryName: accountName,
    beneficiaryAccount: accountNumber, // UI masks via lib/ids.mask()
    amountMinorKes: toNumericColumn(payoutMinor),
    confirmation: "not_required",
    pinUsed: false,
    status: "initialized",
  });

  await writeAudit({
    actor: input.actorId,
    action: "payout.initiated",
    entityType: "payouts",
    entityId: payoutId,
    after: {
      amountMinor: payoutMinor,
      rail: rail.rail,
      reference: merchantReference,
      awaitingConfirmation: true,
    },
  });

  // Money does NOT move here. Execution (Payaza transfer, invoice →
  // paying_out, demo settlement) lives in executePayout(): manual payouts
  // reach it only through confirmPayoutGate() after the confirmation code
  // verifies (confirmation policy "always_ask"); opt-in auto-payouts reach
  // it immediately via initiatePayoutToDefaultRail() (pre-authorized in
  // settings, confirmation "not_required").
  return {
    txnId,
    payoutId,
    status: "awaiting_confirmation" as const,
    amountDisplay: formatMinor("KES", payoutMinor),
    message: `Payout of ${formatMinor("KES", payoutMinor)} to ${isMpesa ? "M-Pesa" : "bank"} ${maskAccount(accountNumber)} created. Confirm to send.`,
  };
}

// --------------------------------------------------------------- execute ----

/**
 * Phase 2 — the ONLY place money moves: the Payaza transfer call, ledger and
 * invoice transitions, and demo settlement scheduling. Idempotent: a payout
 * already past "initialized" is a no-op (guards double-confirms and the
 * auto-payout chain). Amount and reference are frozen at initiate time.
 */
export async function executePayout(
  payoutId: string,
  businessId: string,
  actorId: string,
  confirmation: "not_required" | "otp_confirmed" | "dialog_confirmed" = "otp_confirmed",
) {
  const [row] = await db
    .select({ payout: payouts, txn: transactions })
    .from(payouts)
    .innerJoin(transactions, eq(transactions.id, payouts.transactionId))
    .where(and(eq(payouts.id, payoutId), eq(transactions.businessId, businessId)))
    .limit(1);
  if (!row) throw new Error("payout not found");
  if (row.payout.status !== "initialized") return; // already executed — idempotent
  if (!row.txn.invoiceId) throw new Error("payout transaction is missing its invoice");

  const txnId = row.txn.id;
  const inv = await mustGetInvoice(row.txn.invoiceId, businessId);
  if (inv.status !== "settled") {
    throw new Error("This invoice isn't settled anymore. Refresh and check its status.");
  }
  const biz = await mustGetBusiness(businessId);
  const owner = await getOwnerContact(businessId);
  const [rail] = await db
    .select()
    .from(payoutRails)
    .where(and(eq(payoutRails.id, row.payout.railId), eq(payoutRails.businessId, businessId)))
    .limit(1);
  if (!rail) throw new Error("Payout rail not found. Add your M-Pesa or bank details in Settings.");

  const wallet = await getWalletForCurrency(businessId, "KES");
  if (!wallet) throw new Error("No active KES wallet found on your Payaza account.");
  if (wallet.postNoDebit) {
    throw new Error("Payouts are temporarily frozen on your wallet (PND flag). Contact Payaza support.");
  }

  const payoutMinor = Number(row.payout.amountMinorKes);
  const merchantReference = row.txn.merchantReference;
  const isMpesa = rail.rail === "mpesa";
  const accountNumber = isMpesa ? rail.phone : rail.accountNumber;
  if (!accountNumber) throw new Error("Payout rail is missing its account/phone number.");
  const accountName = row.payout.beneficiaryName;

  try {
    const resp = await initiatePayout({
      transaction_type: isMpesa ? "mobile_money" : "kepss",
      service_payload: {
        payout_amount: minorToMajor("KES", payoutMinor),
        account_reference: wallet.payazaAccountReference,
        currency: "KES",
        country: "KEN",
        payout_beneficiaries: [
          {
            credit_amount: minorToMajor("KES", payoutMinor),
            account_number: accountNumber,
            account_name: accountName,
            bank_code: rail.bankCode ?? (isMpesa ? "SAFKEN" : ""),
            // narration carries OUR merchant reference verbatim — the
            // transfer webhook echoes it back, giving deterministic matching
            // (Payaza's own PTSA reference is unknowable at initiate time).
            narration: merchantReference,
            transaction_reference: merchantReference,
            sender: {
              sender_name: biz.name,
              sender_phone_number: owner?.phone ?? "+254700000000",
              sender_address: "Nairobi, Kenya",
            },
          },
        ],
      },
    });
    const raw = resp.response_content?.response_status ?? String(resp.resp_code ?? resp.response_code);
    const status = payoutRawToTxnStatus(raw);
    await db
      .update(transactions)
      .set({
        status: status === "initialized" ? "pending" : status,
        payazaReference: resp.response_content?.batch_reference ?? null,
        payazaStatusRaw: raw.slice(0, 48),
        payload: resp as unknown as Record<string, unknown>,
      })
      .where(eq(transactions.id, txnId));
    await db.update(payouts).set({ status: "pending", confirmation }).where(eq(payouts.id, payoutId));

    assertInvoiceTransition("settled", "paying_out");
    await db.update(invoices).set({ status: "paying_out", updatedAt: new Date() }).where(eq(invoices.id, inv.id));

    await writeAudit({
      actor: actorId,
      action: "payout.executed",
      entityType: "payouts",
      entityId: payoutId,
      after: { amountMinor: payoutMinor, rail: rail.rail, reference: merchantReference, raw, confirmation },
    });
    publish({ type: "payout.updated", businessId, entityId: payoutId, at: new Date().toISOString() });

    if (env.PAYOUTS_SIMULATED) scheduleDemoSettlement(txnId);

    return {
      txnId,
      payoutId,
      status: "pending" as const,
      amountDisplay: formatMinor("KES", payoutMinor),
      message: `Payout of ${formatMinor("KES", payoutMinor)} initiated to ${isMpesa ? "M-Pesa" : "bank"} ${maskAccount(accountNumber)}.`,
    };
  } catch (err) {
    await db
      .update(transactions)
      .set({ status: "failed", payazaStatusRaw: String(err).slice(0, 48) })
      .where(eq(transactions.id, txnId));
    await db.update(payouts).set({ status: "failed" }).where(eq(payouts.id, payoutId));
    await writeAudit({
      actor: actorId,
      action: "payout.execute_failed",
      entityType: "payouts",
      entityId: payoutId,
      after: { error: String(err).slice(0, 300) },
    });
    const { personaErrorCopy } = await import("@/lib/payaza/endpoints");
    throw new Error(personaErrorCopy(err));
  }
}

/** Auto-payout hook (business setting) — uses the default rail. */
export async function initiatePayoutToDefaultRail(invoiceId: string, businessId: string, actorId: string) {
  const [rail] = await db
    .select()
    .from(payoutRails)
    .where(and(eq(payoutRails.businessId, businessId), eq(payoutRails.isDefault, true)))
    .limit(1);
  if (!rail) throw new Error("no default payout rail");
  const created = await initiateInvoicePayout({ invoiceId, businessId, railId: rail.id, actorId });
  // Auto-payout is pre-authorized in settings — no interactive code gate is
  // possible, so it executes immediately with confirmation "not_required".
  await executePayout(created.payoutId, businessId, actorId, "not_required");
  return created;
}

// ------------------------------------------------- single completion path ---

export interface ApplyPayoutInput {
  txn: Transaction;
  payout: Payout | null;
  status: TxnStatus; // completed | failed | escrow
  feeMajor?: number | null;
  payazaStatusRaw?: string | null;
  payload?: unknown;
  source: "webhook" | "poll" | "demo-replay";
}

export async function applyPayoutResult(input: ApplyPayoutInput): Promise<{ applied: boolean }> {
  const { txn } = input;
  if (txn.status === input.status) return { applied: false };
  assertTxnTransition(txn.status as TxnStatus, input.status);

  const feeMinor = input.feeMajor != null ? Math.round(input.feeMajor * 100) : Number(txn.feeMinor ?? 0);
  await db
    .update(transactions)
    .set({
      status: input.status,
      feeMinor: toNumericColumn(feeMinor),
      netMinor: toNumericColumn(Number(txn.amountMinor) - feeMinor),
      payazaStatusRaw: (input.payazaStatusRaw ?? txn.payazaStatusRaw ?? "").slice(0, 48),
      payload: input.payload ? (input.payload as Record<string, unknown>) : txn.payload,
      occurredAt: new Date(),
    })
    .where(eq(transactions.id, txn.id));

  if (input.payout) {
    await db
      .update(payouts)
      .set({
        status: input.status === "completed" ? "completed" : input.status === "failed" ? "failed" : "pending",
      })
      .where(eq(payouts.id, input.payout.id));
  }

  if (txn.invoiceId && (input.status === "completed" || input.status === "failed")) {
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, txn.invoiceId)).limit(1);
    if (inv) {
      const next = invoiceStatusAfterPayout(input.status);
      try {
        assertInvoiceTransition(inv.status as never, next);
        await db.update(invoices).set({ status: next, updatedAt: new Date() }).where(eq(invoices.id, inv.id));
      } catch (err) {
        await writeAudit({
          actor: "system",
          action: "invoice.transition_blocked",
          entityType: "invoices",
          entityId: inv.id,
          after: { from: inv.status, attempted: next, reason: String(err) },
        });
      }
      await notifyPayoutOutcome(inv, Number(txn.amountMinor), input.status === "completed");
    }
  }

  await writeAudit({
    actor: "system",
    action: `payout.${input.status}`,
    entityType: "transactions",
    entityId: txn.id,
    after: { source: input.source, feeMinor, raw: input.payazaStatusRaw },
  });
  publish({ type: "payout.updated", businessId: txn.businessId, entityId: txn.id, at: new Date().toISOString() });
  if (txn.invoiceId) {
    publish({ type: "invoice.updated", businessId: txn.businessId, entityId: txn.invoiceId, at: new Date().toISOString() });
  }
  return { applied: true };
}

// ------------------------------------------------------------ settlement ----

/** paid → settling → settled with audit (local T+1 advance / demo simulate). */
export async function advanceSettlement(inv: Invoice, actor: string, reason: string) {
  assertInvoiceTransition(inv.status as never, "settling");
  await db.update(invoices).set({ status: "settling", updatedAt: new Date() }).where(eq(invoices.id, inv.id));
  await writeAudit({ actor, action: "invoice.settling", entityType: "invoices", entityId: inv.id, after: { reason } });
  assertInvoiceTransition("settling", "settled");
  await db.update(invoices).set({ status: "settled", updatedAt: new Date() }).where(eq(invoices.id, inv.id));
  await writeAudit({ actor, action: "invoice.settled", entityType: "invoices", entityId: inv.id, after: { reason } });
  publish({ type: "invoice.updated", businessId: inv.businessId, entityId: inv.id, at: new Date().toISOString() });
}

/** Demo-only: simulate the Payaza settlement landing (button on invoice page). */
export async function simulateSettlement(invoiceId: string, businessId: string) {
  if (!env.DEMO_TOOLS) throw new Error("settlement simulation is Demo Mode only");
  const inv = await mustGetInvoice(invoiceId, businessId);
  if (inv.status !== "paid") throw new Error(`invoice must be paid to simulate settlement (is: ${inv.status})`);
  await advanceSettlement(inv, "system:demo", "demo simulate-settlement button");
}

// ------------------------------------------------------------------- gate ----

/**
 * Confirmation gate (business setting confirmationPolicy=always_ask).
 * DEMO: fixed code surfaced in the dialog ("Demo confirmation: 123456").
 * LIVE: Payaza secures payouts with the dashboard PIN (env-injected); the
 * Kusanya-side gate remains as a second control — v1 adds phone OTP via AT.
 */
export const DEMO_PAYOUT_CODE = "123456";

export async function confirmPayoutGate(payoutId: string, businessId: string, code: string, actorId: string) {
  const rows = await db
    .select({ payout: payouts, txn: transactions })
    .from(payouts)
    .innerJoin(transactions, eq(transactions.id, payouts.transactionId))
    .where(and(eq(payouts.id, payoutId), eq(transactions.businessId, businessId)))
    .limit(1);
  if (!rows[0]) throw new Error("payout not found");
  if (code !== DEMO_PAYOUT_CODE) throw new Error("Wrong confirmation code.");
  if (rows[0].payout.status !== "initialized") return; // already executed — idempotent
  await writeAudit({
    actor: actorId,
    action: "payout.gate_confirmed",
    entityType: "payouts",
    entityId: payoutId,
    after: { method: env.DEMO_TOOLS ? "demo-code" : "pin" },
  });
  // The gate is the trigger: money moves ONLY after the code verifies.
  await executePayout(payoutId, businessId, actorId, "otp_confirmed");
}

// -------------------------------------------------------------- demo settle --

/**
 * Demo Mode: 1.5s after initiation, replay a synthetic NIP_SUCCESS transfer
 * webhook through the SAME completion path a live webhook uses — plus a real
 * webhook_events row so the audit trail is complete.
 */
function scheduleDemoSettlement(txnId: string) {
  // runInBackground, not a bare setTimeout: on Vercel a timer that outlives the
  // response is frozen, which left payouts stuck on "Paying out".
  runInBackground(async () => {
    try {
      const { demoWebhookPayoutSuccess } = await import("@/lib/payaza/demo-payloads");
      const [txn] = await db.select().from(transactions).where(eq(transactions.id, txnId)).limit(1);
      if (!txn || txn.status === "completed") return;
      const payload = demoWebhookPayoutSuccess(txn.merchantReference);
      await db
        .insert(webhookEvents)
        .values({
          id: newId("wev"),
          eventKind: "transfer",
          transactionReference: payload.transaction_reference,
          signatureValid: false,
          dedupeKey: `demo:${payload.transaction_reference}:NIP_SUCCESS`,
          payload: payload as unknown as Record<string, unknown>,
          processed: false,
        })
        .onConflictDoNothing();
      const [payout] = await db.select().from(payouts).where(eq(payouts.transactionId, txnId)).limit(1);
      await applyPayoutResult({
        txn,
        payout: payout ?? null,
        status: "completed",
        feeMajor: payload.transaction_fee,
        payazaStatusRaw: payload.transaction_status,
        payload,
        source: "demo-replay",
      });
      await db
        .update(webhookEvents)
        .set({ processed: true })
        .where(eq(webhookEvents.transactionReference, payload.transaction_reference));
    } catch (err) {
      console.error("[demo-settle] failed:", err);
    }
  }, DEMO_SETTLEMENT_DELAY_MS);
}

// ------------------------------------------------------------- reconcile ----

/** Poll PENDING payouts so nothing waits on a lost transfer webhook. */
export async function reconcilePendingPayouts(limit = 20) {
  const { payoutStatus } = await import("@/lib/payaza/endpoints");
  const stale = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.kind, "payout"), eq(transactions.status, "pending")))
    .limit(limit);
  let advanced = 0;
  for (const txn of stale) {
    const ageMin = (Date.now() - (txn.createdAt?.getTime() ?? Date.now())) / 60_000;
    if (ageMin < 3) continue;
    const ref = txn.payazaReference ?? txn.merchantReference;
    try {
      const resp = await payoutStatus(ref);
      const data = (resp.data ?? resp) as Record<string, unknown>;
      const raw = String(data.transaction_status ?? data.status ?? "").toUpperCase();
      const mapped = payoutRawToTxnStatus(raw);
      if (mapped === "completed" || mapped === "failed") {
        const [payout] = await db.select().from(payouts).where(eq(payouts.transactionId, txn.id)).limit(1);
        await applyPayoutResult({
          txn,
          payout: payout ?? null,
          status: mapped,
          feeMajor: typeof data.transaction_fee === "number" ? data.transaction_fee : null,
          payazaStatusRaw: `poll:${raw}`.slice(0, 48),
          source: "poll",
        });
        advanced++;
      }
    } catch (err) {
      console.warn("[reconcile] payout poll failed for", ref, err);
    }
  }
  return { checked: stale.length, advanced };
}

// ----------------------------------------------------------------- helpers --

async function notifyPayoutOutcome(inv: Invoice, amountMinor: number, success: boolean) {
  const owner = await getOwnerContact(inv.businessId);
  if (!owner) return;
  const amountDisplay = formatMinor("KES", amountMinor);
  const [rail] = await db
    .select()
    .from(payoutRails)
    .where(and(eq(payoutRails.businessId, inv.businessId), eq(payoutRails.isDefault, true)))
    .limit(1);
  const destination = rail
    ? rail.rail === "mpesa"
      ? `M-Pesa ${maskAccount(rail.phone ?? "")}`
      : `Bank ${maskAccount(rail.accountNumber ?? "")}`
    : "your rail";

  if (success) {
    if (owner.email) {
      await sendEmail({
        to: owner.email,
        subject: `Imefika! ${amountDisplay} Paid Out For ${inv.number}`,
        html: payoutSentEmail({
          merchantName: owner.business.name,
          amountDisplay,
          destination,
          etaDisplay: "minutes (M-Pesa) / same day (kepss)",
          invoiceNumber: inv.number,
        }),
        tag: "payout-sent",
      });
    }
    if (owner.phone) {
      await sendSms(owner.phone, `KUSANYA: Imefika! ${amountDisplay} from invoice ${inv.number} is on its way to ${destination}.`);
    }
  } else if (owner.email) {
    await sendEmail({
      to: owner.email,
      subject: `Payout Failed For ${inv.number} (Funds Safe)`,
      html: payoutFailedEmail({
        merchantName: owner.business.name,
        amountDisplay,
        reason: "the destination account rejected the transfer",
      }),
      tag: "payout-failed",
    });
  }
}

function maskAccount(s: string) {
  return s.length > 6 ? `${s.slice(0, 3)}****${s.slice(-3)}` : "****";
}

export type { PayoutRail };

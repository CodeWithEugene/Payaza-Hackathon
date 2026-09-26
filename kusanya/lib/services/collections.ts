import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  buyers,
  invoiceSplits,
  invoices,
  splitBeneficiaries,
  transactions,
  type Invoice,
  type Transaction,
} from "@/lib/db/schema";
import { newId, newMerchantReference } from "@/lib/ids";
import { toNumericColumn, minorToMajor, formatMinor } from "@/lib/money/format";
import { minorFactor, type CurrencyCode } from "@/lib/money/currencies";
import {
  processCollection,
  checkCollectionStatus,
  merchantTransactionQuery,
  normalizeMsisdn,
  MOMO_BANK_CODES,
  personaErrorCopy,
} from "@/lib/payaza/endpoints";
import {
  assertTxnTransition,
  assertInvoiceTransition,
  collectionCodeToTxnStatus,
  invoiceStatusAfterCollection,
  type TxnStatus,
} from "@/lib/payaza/state-machine";
import { writeAudit } from "@/lib/db/audit";
import { publish } from "./events";
import { getOwnerContact } from "./business";
import { sendEmail } from "@/lib/notify/email";
import { receiptEmail } from "@/lib/notify/templates";
import { sendSms } from "@/lib/notify/sms";
import { env } from "@/lib/config/env";

/**
 * Collections service — momo prompts, Checkout SDK sessions, and the SINGLE
 * completion path (applyCollectionResult) shared by webhook, polling cron,
 * and checkout callbacks. One code path = one state machine (build.md §6.5).
 */

const COUNTRY_CURRENCY: Record<string, CurrencyCode> = { KE: "KES", UG: "UGX", TZ: "TZS" };
const COUNTRY_CHANNEL: Record<string, Transaction["channel"]> = {
  KE: "momo_ke",
  UG: "momo_ug",
  TZ: "momo_tz",
};

export interface StartMomoInput {
  invoiceId: string;
  businessId: string;
  phone: string; // any local format
  country: "KE" | "UG" | "TZ";
  network?: string;
}

export async function startMomoCollection(input: StartMomoInput) {
  const inv = await mustGetInvoiceScoped(input.invoiceId, input.businessId);
  assertPayable(inv);
  const expected = COUNTRY_CURRENCY[input.country];
  if (inv.currency !== expected) {
    throw new Error(
      `Invoice is in ${inv.currency} — mobile money for ${input.country} collects ${expected}. Buyers paying by card use the Pay button instead.`,
    );
  }
  const msisdn = normalizeMsisdn(input.country, input.phone);
  if (!msisdn) throw new Error("Enter a valid mobile money number (e.g. 07XX XXX XXX)");

  const [buyerRow] = await db.select().from(buyers).where(eq(buyers.id, inv.buyerId)).limit(1);
  if (!buyerRow) throw new Error("buyer not found");

  const codes = MOMO_BANK_CODES[input.country] as Record<string, string>;
  const bankCode = (input.network && codes[input.network]) || codes.mpesa || codes.mtn || codes.vodacom || Object.values(codes)[0]!;

  const txnId = newId("txn");
  const merchantReference = newMerchantReference();
  await db.insert(transactions).values({
    id: txnId,
    businessId: input.businessId,
    invoiceId: inv.id,
    merchantReference,
    kind: "collection",
    direction: "in",
    channel: COUNTRY_CHANNEL[input.country],
    currency: inv.currency,
    amountMinor: toNumericColumn(Number(inv.amountMinor)),
    status: "initialized",
    occurredAt: new Date(),
  });

  const amountMajor = minorToMajor(inv.currency as CurrencyCode, Number(inv.amountMinor));
  const [firstName, ...rest] = buyerRow.name.split(" ");
  try {
    const resp = await processCollection({
      amount: amountMajor,
      customer_number: msisdn,
      transaction_reference: merchantReference,
      transaction_description: `Invoice ${inv.number}`,
      customer_bank_code: bankCode,
      currency_code: inv.currency,
      customer_email: buyerRow.email ?? "buyer@kusanya.app",
      customer_first_name: firstName ?? "Buyer",
      customer_last_name: rest.join(" ") || ".",
      customer_phone_number: msisdn,
      country_code: input.country,
    });
    const status = collectionCodeToTxnStatus(resp.response_code, resp.response_message);
    await db
      .update(transactions)
      .set({
        status,
        payazaReference: resp.transaction_reference ?? null,
        payazaStatusRaw: `${resp.response_code}:${resp.response_message}`.slice(0, 48),
        payload: redact(resp),
      })
      .where(eq(transactions.id, txnId));
    await writeAudit({
      actor: "system",
      action: "collection.prompt_sent",
      entityType: "transactions",
      entityId: txnId,
      after: { reference: merchantReference, code: resp.response_code, msisdn: maskMsisdn(msisdn) },
    });
    publish({ type: "transaction.updated", businessId: input.businessId, entityId: txnId, at: new Date().toISOString() });
    return {
      txnId,
      merchantReference,
      status,
      message:
        status === "pending"
          ? `Prompt sent to ${maskMsisdn(msisdn)} — approve it on the phone.`
          : resp.response_message,
    };
  } catch (err) {
    await db
      .update(transactions)
      .set({ status: "failed", payazaStatusRaw: String(err).slice(0, 48) })
      .where(eq(transactions.id, txnId));
    throw new Error(personaErrorCopy(err));
  }
}

/**
 * Checkout SDK session (USD card / Apple Pay / Google Pay). Creates the
 * ledger txn FIRST so the webhook's merchant_reference always matches.
 * split_accounts ride through the SDK (Object.assign passthrough — verified
 * in node_modules/payaza-web-sdk/src/PayazaCheckout.ts).
 */
export async function startCheckoutSession(
  invoiceId: string,
  businessId: string,
  opts: { useSplits?: boolean } = {},
) {
  const inv = await mustGetInvoiceScoped(invoiceId, businessId);
  assertPayable(inv);
  const [buyerRow] = await db.select().from(buyers).where(eq(buyers.id, inv.buyerId)).limit(1);
  if (!buyerRow) throw new Error("invoice context missing");

  const txnId = newId("txn");
  const merchantReference = newMerchantReference();
  await db.insert(transactions).values({
    id: txnId,
    businessId,
    invoiceId: inv.id,
    merchantReference,
    kind: "collection",
    direction: "in",
    channel: "card",
    currency: inv.currency,
    amountMinor: toNumericColumn(Number(inv.amountMinor)),
    status: "initialized",
    occurredAt: new Date(),
  });
  await db
    .update(invoices)
    .set({ checkoutSessionRef: merchantReference, updatedAt: new Date() })
    .where(eq(invoices.id, inv.id));

  let splitAccounts: string[] | undefined;
  if (opts.useSplits) {
    const rows = await db
      .select({ code: splitBeneficiaries.payazaSplitCode })
      .from(invoiceSplits)
      .innerJoin(splitBeneficiaries, eq(splitBeneficiaries.id, invoiceSplits.beneficiaryId))
      .where(eq(invoiceSplits.invoiceId, inv.id));
    const codes = rows.map((r) => r.code).filter((c): c is string => !!c);
    if (codes.length) splitAccounts = codes;
  }

  const [firstName, ...rest] = buyerRow.name.split(" ");
  return {
    txnId,
    sdkConfig: {
      merchant_key: env.PAYAZA_PUBLIC_KEY ?? "pk_demo_placeholder",
      connection_mode: env.PAYAZA_TENANT === "live" ? "Live" : "Test",
      checkout_amount: minorToMajor(inv.currency as CurrencyCode, Number(inv.amountMinor)),
      currency_code: inv.currency,
      currency: inv.currency,
      email_address: buyerRow.email ?? "buyer@kusanya.app",
      first_name: firstName ?? "Buyer",
      last_name: rest.join(" ") || ".",
      phone_number: buyerRow.phone ?? undefined,
      transaction_reference: merchantReference,
      ...(splitAccounts ? { split_accounts: splitAccounts } : {}),
    },
    merchantReference,
  };
}

/**
 * Checkout client callback = HINT ONLY (guides: always verify server-side).
 * Verifies via merchantTransactionQuery, then runs the single completion path.
 */
export async function handleCheckoutCallback(merchant_reference: string) {
  const [txn] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.merchantReference, merchant_reference))
    .limit(1);
  if (!txn) return { found: false as const };

  const query = await merchantTransactionQuery(merchant_reference);
  const data = (query.data ?? {}) as Record<string, unknown>;
  const status = String(data.status ?? data.transaction_status ?? "").toLowerCase();
  const verified = status.includes("success") || status.includes("completed");
  if (!verified) return { found: true as const, verified: false as const };

  await applyCollectionResult({
    txn,
    status: "completed",
    amountReceivedMajor: typeof data.amount === "number" ? data.amount : null,
    feeMajor: typeof data.transaction_fee === "number" ? data.transaction_fee : null,
    amountValidation: "EXACT",
    payazaStatusRaw: `query:${status}`.slice(0, 48),
    source: "callback",
  });
  return { found: true as const, verified: true as const };
}

// ------------------------------------------------- single completion path ----

export interface ApplyCollectionInput {
  txn: Transaction;
  status: TxnStatus; // completed | failed
  amountReceivedMajor?: number | null;
  feeMajor?: number | null;
  amountValidation?: "EXACT" | "UNDERPAYMENT" | "OVERPAYMENT" | null;
  payerName?: string | null;
  payerAccount?: string | null;
  payazaStatusRaw?: string | null;
  channelOverride?: Transaction["channel"] | null;
  occurredAt?: Date;
  payload?: unknown;
  source: "webhook" | "poll" | "callback";
}

export async function applyCollectionResult(
  input: ApplyCollectionInput,
): Promise<{ applied: boolean }> {
  const { txn } = input;
  if (txn.status === input.status) return { applied: false }; // idempotent
  assertTxnTransition(txn.status as TxnStatus, input.status);

  const cur = txn.currency as CurrencyCode;
  const amountMinor =
    input.amountReceivedMajor != null
      ? Math.round(input.amountReceivedMajor * minorFactor(cur))
      : Number(txn.amountMinor);
  const feeMinor =
    input.feeMajor != null ? Math.round(input.feeMajor * minorFactor(cur)) : 0;

  await db
    .update(transactions)
    .set({
      status: input.status,
      amountMinor: toNumericColumn(amountMinor),
      feeMinor: toNumericColumn(feeMinor),
      netMinor: toNumericColumn(amountMinor - feeMinor),
      payazaStatusRaw: (input.payazaStatusRaw ?? txn.payazaStatusRaw ?? "").slice(0, 48),
      channel: input.channelOverride ?? txn.channel,
      payload: input.payload ? redact(input.payload) : txn.payload,
      occurredAt: input.occurredAt ?? new Date(),
    })
    .where(eq(transactions.id, txn.id));

  if (txn.invoiceId && input.status === "completed") {
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, txn.invoiceId)).limit(1);
    if (inv) {
      const { status: next, needsMerchantAlert } = invoiceStatusAfterCollection(input.amountValidation);
      try {
        assertInvoiceTransition(inv.status as never, next);
        await db
          .update(invoices)
          .set({ status: next, updatedAt: new Date() })
          .where(eq(invoices.id, inv.id));
        if (next === "paid") {
          const { markSplitsSettled } = await import("./splits");
          await markSplitsSettled(inv.id, amountMinor);
        }
        await notifyPaymentReceived(inv, amountMinor, cur, needsMerchantAlert, input.amountValidation);
      } catch (err) {
        // Invoice already advanced (e.g. duplicate webhook after partial) — record, don't crash.
        await writeAudit({
          actor: "system",
          action: "invoice.transition_blocked",
          entityType: "invoices",
          entityId: inv.id,
          after: { from: inv.status, attempted: next, reason: String(err) },
        });
      }
    }
  }

  await writeAudit({
    actor: "system",
    action: `collection.${input.status}`,
    entityType: "transactions",
    entityId: txn.id,
    after: {
      source: input.source,
      amountMinor,
      feeMinor,
      validation: input.amountValidation ?? "EXACT",
      payer: input.payerName ? maskName(input.payerName) : undefined,
      payerAccount: input.payerAccount ? maskAccount(input.payerAccount) : undefined,
    },
  });
  publish({ type: "transaction.updated", businessId: txn.businessId, entityId: txn.id, at: new Date().toISOString() });
  if (txn.invoiceId) {
    publish({ type: "invoice.updated", businessId: txn.businessId, entityId: txn.invoiceId, at: new Date().toISOString() });
  }

  // Auto-payout (opt-in per business) — KES collections only for MVP.
  if (input.status === "completed" && txn.invoiceId && cur === "KES") {
    const owner = await getOwnerContact(txn.businessId);
    const settings = (owner?.business.settings ?? {}) as { autoPayout?: boolean };
    if (settings.autoPayout) {
      try {
        const { initiatePayoutToDefaultRail } = await import("./payouts");
        await initiatePayoutToDefaultRail(txn.invoiceId, txn.businessId, "system:auto-payout");
      } catch (err) {
        await writeAudit({
          actor: "system",
          action: "payout.auto_failed",
          entityType: "invoices",
          entityId: txn.invoiceId,
          after: { error: String(err).slice(0, 200) },
        });
      }
    }
  }
  return { applied: true };
}

/** Polling reconciliation for PENDING momo prompts (build.md §6.6). */
export async function reconcilePendingCollections(limit = 20) {
  const stale = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.kind, "collection"), eq(transactions.status, "pending")))
    .limit(limit);
  let advanced = 0;
  for (const txn of stale) {
    const ageMin = (Date.now() - (txn.createdAt?.getTime() ?? Date.now())) / 60_000;
    if (ageMin < 2) continue; // give the webhook its 2-minute head start
    const country = txn.channel === "momo_ug" ? "UG" : txn.channel === "momo_tz" ? "TZ" : "KE";
    try {
      const status = await checkCollectionStatus(txn.merchantReference, country);
      const mapped = collectionCodeToTxnStatus(status.response_code, status.transaction_status ?? undefined);
      if (mapped === "completed" || mapped === "failed") {
        await applyCollectionResult({
          txn,
          status: mapped,
          amountReceivedMajor: status.transaction_amount ?? null,
          feeMajor: status.transaction_fee ?? null,
          amountValidation: "EXACT",
          payerName: status.payer_name ?? null,
          payerAccount: status.payer_account_number ?? null,
          payazaStatusRaw: `poll:${status.response_code}:${status.transaction_status ?? ""}`.slice(0, 48),
          source: "poll",
        });
        advanced++;
      } else if (ageMin > 60 * 24) {
        // 24h stale prompt → failed (customer never approved)
        await applyCollectionResult({ txn, status: "failed", payazaStatusRaw: "poll:stale_24h", source: "poll" });
        advanced++;
      }
    } catch (err) {
      console.warn("[reconcile] poll failed for", txn.merchantReference, err);
    }
  }
  return { checked: stale.length, advanced };
}

// ------------------------------------------------------------------ helpers --

function assertPayable(inv: Invoice) {
  if (!["sent", "partially_paid", "ready"].includes(inv.status)) {
    throw new Error(`Invoice ${inv.number} is not open for payment (status: ${inv.status})`);
  }
}

async function mustGetInvoiceScoped(invoiceId: string, businessId: string): Promise<Invoice> {
  const rows = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.businessId, businessId)))
    .limit(1);
  if (!rows[0]) throw new Error("invoice not found");
  return rows[0];
}

async function notifyPaymentReceived(
  inv: Invoice,
  amountMinor: number,
  currency: CurrencyCode,
  needsMerchantAlert: boolean,
  validation: string | null | undefined,
) {
  const amountDisplay = formatMinor(currency, amountMinor);
  const [buyerRow] = await db.select().from(buyers).where(eq(buyers.id, inv.buyerId)).limit(1);
  const owner = await getOwnerContact(inv.businessId);
  const paidAt = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";

  if (buyerRow?.email) {
    await sendEmail({
      to: buyerRow.email,
      subject: `Receipt — invoice ${inv.number}`,
      html: receiptEmail({
        buyerName: buyerRow.name.split(" ")[0]!,
        invoiceNumber: inv.number,
        amountDisplay,
        reference: inv.number,
        paidAt,
      }),
      tag: "receipt",
    });
  }
  if (owner?.email) {
    const note = needsMerchantAlert
      ? `⚠ ${validation === "UNDERPAYMENT" ? "UNDERPAYMENT" : "OVERPAYMENT"} detected — review the transparency panel.`
      : "";
    await sendEmail({
      to: owner.email,
      subject: `Paid: ${inv.number} — ${amountDisplay}${note ? " (attention)" : ""}`,
      html: `<p>Invoice <strong>${inv.number}</strong> received <strong>${amountDisplay}</strong> at ${paidAt}.</p><p>${note}</p>`,
      tag: "merchant-paid",
    });
  }
  if (owner?.phone && !needsMerchantAlert) {
    await sendSms(owner.phone, `KUSANYA: Cha kwanza! Invoice ${inv.number} paid — ${amountDisplay}.`);
  }
  if (needsMerchantAlert) {
    publish({
      type: "invoice.updated",
      businessId: inv.businessId,
      entityId: inv.id,
      at: new Date().toISOString(),
      data: { alert: validation },
    });
  }
}

/** Strip anything that could carry PAN/secrets before persisting payloads. */
export function redact(payload: unknown): unknown {
  const json = JSON.stringify(payload ?? null);
  const cleaned = json.replace(/"card_number"\s*:\s*"[^"]*"/g, '"card_number":"[REDACTED]"');
  return JSON.parse(cleaned);
}

function maskMsisdn(s: string) {
  return `${s.slice(0, 5)}****${s.slice(-3)}`;
}
function maskName(s: string) {
  const parts = s.split(" ");
  return parts.map((p, i) => (i === 0 ? p : `${p[0]}***`)).join(" ");
}
function maskAccount(s: string) {
  return s.length > 6 ? `${s.slice(0, 3)}****${s.slice(-3)}` : "****";
}

import "server-only";
import { z } from "zod";
import { env } from "@/lib/config/env";
import { payazaFetch, PayazaError } from "./client";
import * as demo from "./demo-payloads";
import {
  processCollectionRequestSchema,
  processCollectionResponseSchema,
  collectionStatusResponseSchema,
  payoutRequestSchema,
  payoutResponseSchema,
  payoutStatusResponseSchema,
  createPaymentLinkRequestSchema,
  createPaymentLinkResponseSchema,
  looseEnvelopeSchema,
  accountEnquiryResponseSchema,
  bankCodesResponseSchema,
  createSplitAccountRequestSchema,
  createSplitAccountResponseSchema,
  cardChargeRequestSchema,
  cardChargeResponseSchema,
  mobilePaymentInitiateRequestSchema,
  mobilePaymentInitiateResponseSchema,
  refundRequestSchema,
  type ProcessCollectionRequest,
  type ProcessCollectionResponse,
  type CollectionStatusResponse,
  type PayoutRequest,
  type PayoutResponse,
  type CreatePaymentLinkRequest,
  type CreatePaymentLinkResponse,
  type AccountEnquiryResponse,
  type CreateSplitAccountRequest,
  type CreateSplitAccountResponse,
  type CardChargeRequest,
  type CardChargeResponse,
} from "./types";

/**
 * Typed endpoint catalog (build.md §6.2) — every function either hits the
 * live API through payazaFetch or returns a Demo Mode fixture with the
 * IDENTICAL shape. Callers never branch on demo mode themselves.
 */

const DEMO = () => env.DEMO_MODE;
/** Payout rail + wallet enquiry: fixtures in Demo Mode OR while the sandbox wallet is pending. */
const PAYOUT_FIXTURES = () => env.PAYOUTS_SIMULATED;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------ collections ----

/** MoMo collection prompt (KES/UGX/TZS). 09/PENDING = prompt sent ✓. */
export async function processCollection(
  input: ProcessCollectionRequest,
): Promise<ProcessCollectionResponse> {
  const body = processCollectionRequestSchema.parse(input);
  if (DEMO()) {
    await sleep(demo.DEMO_LATENCY_MS.prompt);
    return demo.demoProcessCollectionPending(body.transaction_reference);
  }
  return payazaFetch(
    "/subsidiary/collections/v1/process-collection",
    processCollectionResponseSchema,
    { method: "POST", body },
  );
}

/** Status query — polling fallback while a txn is PENDING (build.md §6.6). */
export async function checkCollectionStatus(
  transaction_reference: string,
  country_code: string,
): Promise<CollectionStatusResponse> {
  if (DEMO()) {
    await sleep(demo.DEMO_LATENCY_MS.fast);
    return demo.demoCollectionStatus(transaction_reference, "pending");
  }
  return payazaFetch(
    "/subsidiary/collections/v1/check-status",
    collectionStatusResponseSchema,
    { query: { transaction_reference, country_code } },
  );
}

/**
 * SANDBOX ONLY: simulates the customer approving the USSD prompt
 * (docs: test account funding). Never callable in live tenant.
 */
export async function fundTestCollection(
  input: ProcessCollectionRequest,
): Promise<ProcessCollectionResponse> {
  const body = processCollectionRequestSchema.parse(input);
  if (env.PAYAZA_TENANT === "live") {
    throw new PayazaError(
      "/subsidiary/funding/v1/process-collection",
      0,
      undefined,
      "test funding is sandbox-only",
    );
  }
  if (DEMO()) {
    await sleep(demo.DEMO_LATENCY_MS.fast);
    return { response_code: "00", response_message: "SUCCESS", transaction_reference: body.transaction_reference };
  }
  return payazaFetch(
    "/subsidiary/funding/v1/process-collection",
    processCollectionResponseSchema,
    { method: "POST", body },
  );
}

// ------------------------------------------------------------ card / wallets --

/** Server-side USD card charge (fallback path when SDK modal is unusable). */
export async function cardCharge(
  input: CardChargeRequest,
): Promise<CardChargeResponse> {
  const body = cardChargeRequestSchema.parse(input);
  if (DEMO()) {
    await sleep(demo.DEMO_LATENCY_MS.fast);
    // Test-card semantics (research §4.8): expiry drives outcome.
    const approved = body.expiry === "01/39";
    return {
      code: approved ? "00" : "06",
      message: approved ? "Approved" : "Declined",
      status: approved,
      data: {
        response_code: approved ? "00" : "06",
        response_message: approved ? "Approved" : "Declined (demo card rule: use 01/39)",
        transaction_reference: body.merchant_reference,
        status: approved ? "success" : "failed",
        amount: body.amount,
        currency: body.currency,
      },
    };
  }
  return payazaFetch("/card/card_charge/", cardChargeResponseSchema, {
    method: "POST",
    body,
  });
}

export async function cardTransactionStatus(transaction_reference: string) {
  if (DEMO()) {
    await sleep(demo.DEMO_LATENCY_MS.fast);
    return { code: "00", message: "success", data: { transaction_reference, status: "success", response_code: "00" } };
  }
  return payazaFetch(
    "/card/card_charge/transaction_status",
    looseEnvelopeSchema,
    { method: "POST", body: { transaction_reference } },
  );
}

/** Apple Pay / Google Pay initiate (server-side, confirm via webhook). */
export async function initiateMobilePayment(input: unknown) {
  const body = mobilePaymentInitiateRequestSchema.parse(input);
  if (DEMO()) {
    await sleep(demo.DEMO_LATENCY_MS.fast);
    return {
      response_code: "09",
      response_message: "PENDING",
      transaction_reference: body.transaction_reference,
    };
  }
  return payazaFetch(
    "/merchant-collection/mobile_payment/initiate",
    mobilePaymentInitiateResponseSchema,
    { method: "POST", body },
  );
}

// ---------------------------------------------------------- payment links ----

export async function createPaymentLink(
  input: CreatePaymentLinkRequest,
): Promise<CreatePaymentLinkResponse> {
  const body = createPaymentLinkRequestSchema.parse(input);
  if (DEMO()) {
    await sleep(demo.DEMO_LATENCY_MS.fast);
    return demo.demoCreatePaymentLink(
      body.custom_url ?? body.payment_link_name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      body.payment_amount ?? 0,
    );
  }
  return payazaFetch(
    "/payment-link/merchant/create-payment-link",
    createPaymentLinkResponseSchema,
    { method: "POST", body },
  );
}

export async function fetchPaymentLinks(page = 1) {
  if (DEMO()) return { status: true, message: "demo", data: [] };
  return payazaFetch("/payment-link/merchant/fetch-payment-links", looseEnvelopeSchema, {
    query: { page },
  });
}

export async function fetchPaymentLinkTransactions(link_id: string | number) {
  if (DEMO()) return { status: true, message: "demo", data: [] };
  return payazaFetch(
    "/payment-link/merchant/fetch-payment-link-transactions",
    looseEnvelopeSchema,
    { query: { link_id } },
  );
}

/** Checkout-callback verification: query by OUR merchant reference. */
export async function merchantTransactionQuery(merchant_reference: string) {
  if (DEMO()) {
    await sleep(demo.DEMO_LATENCY_MS.fast);
    return { status: true, message: "demo", data: { merchant_reference, status: "success" } };
  }
  return payazaFetch(
    "/merchant-collection/transfer_notification_controller/merchant/transaction-query",
    looseEnvelopeSchema,
    { method: "POST", body: { merchant_reference } },
  );
}

// ---------------------------------------------------------------- payouts ----

/**
 * Initiate payout (KES mobile_money → M-Pesa, kepss → bank; UGX/TZS momo).
 * Live: injects PAYAZA_PAYOUT_PIN server-side (never from client).
 */
export async function initiatePayout(input: PayoutRequest): Promise<PayoutResponse> {
  const body = payoutRequestSchema.parse(input);
  if (env.PAYAZA_TENANT === "live" && !body.service_payload.transaction_pin) {
    if (!env.PAYAZA_PAYOUT_PIN) {
      throw new PayazaError("/payout-receptor/payout", 0, undefined, "live payout requires PAYAZA_PAYOUT_PIN");
    }
    body.service_payload.transaction_pin = Number(env.PAYAZA_PAYOUT_PIN);
  }
  if (PAYOUT_FIXTURES()) {
    await sleep(demo.DEMO_LATENCY_MS.prompt);
    return demo.demoPayoutInitiated();
  }
  return payazaFetch("/payout-receptor/payout", payoutResponseSchema, {
    method: "POST",
    body,
  });
}

export async function payoutStatus(transaction_reference: string) {
  if (PAYOUT_FIXTURES()) {
    await sleep(demo.DEMO_LATENCY_MS.fast);
    return { status: true, message: "demo", data: { transaction_status: "NIP_SUCCESS", transaction_reference } };
  }
  return payazaFetch(
    `/payaza-account/api/v1/mainaccounts/merchant/transaction/${encodeURIComponent(transaction_reference)}`,
    payoutStatusResponseSchema,
  );
}

// --------------------------------------------------------------- accounts ----

/** Wallet balances + payazaAccountReference per currency (cached 60s by caller). */
export async function accountEnquiry(): Promise<AccountEnquiryResponse> {
  if (PAYOUT_FIXTURES()) {
    await sleep(demo.DEMO_LATENCY_MS.fast);
    return demo.demoAccountEnquiry();
  }
  return payazaFetch(
    "/payaza-account/api/v1/mainaccounts/merchant/enquiry/main",
    accountEnquiryResponseSchema,
  );
}

/** Bank codes for a currency (cached 24h by caller). */
export async function bankCodes(currency_code: string) {
  if (DEMO()) {
    await sleep(demo.DEMO_LATENCY_MS.fast);
    if (currency_code.toUpperCase() === "KES") return demo.demoBankCodesKE();
    return { status: true, message: "demo", data: [] };
  }
  return payazaFetch(
    `/payaza-account/api/v1/mainaccounts/merchant/banks/${encodeURIComponent(currency_code)}`,
    bankCodesResponseSchema,
  );
}

// --------------------------------------------------------- split accounts ----

export async function createSplitAccount(
  input: CreateSplitAccountRequest,
): Promise<CreateSplitAccountResponse> {
  const body = createSplitAccountRequestSchema.parse(input);
  if (DEMO()) {
    await sleep(demo.DEMO_LATENCY_MS.fast);
    return demo.demoCreateSplitAccount();
  }
  return payazaFetch(
    "/settlement/settlement/merchant/split-account",
    createSplitAccountResponseSchema,
    { method: "POST", body },
  );
}

export async function fetchSplitAccounts() {
  if (DEMO()) return { code: "00", success: true, data: [] };
  return payazaFetch("/settlement/settlement/merchant/split-account", looseEnvelopeSchema);
}

export async function updateSplitAccount(id: string | number, input: Partial<CreateSplitAccountRequest>) {
  if (DEMO()) return { code: "00", success: true, message: "demo updated" };
  return payazaFetch(`/settlement/settlement/merchant/split-account/${id}`, looseEnvelopeSchema, {
    method: "PUT",
    body: input,
  });
}

export async function deleteSplitAccount(id: string | number) {
  if (DEMO()) return { code: "00", success: true, message: "demo deleted" };
  return payazaFetch(`/settlement/settlement/merchant/split-account/${id}`, looseEnvelopeSchema, {
    method: "DELETE",
  });
}

// ---------------------------------------------------------------- refunds ----

export async function refund(input: unknown) {
  const body = refundRequestSchema.parse(input);
  if (DEMO()) {
    await sleep(demo.DEMO_LATENCY_MS.fast);
    return { code: "00", success: true, message: "demo refund accepted" };
  }
  return payazaFetch("/refund-chargeback/refund/merchant/api/refund", looseEnvelopeSchema, {
    method: "POST",
    body,
  });
}

// ------------------------------------------------------------ error copy -----

/**
 * Payaza response → persona copy (build.md §6.6). Shown in buyer/merchant
 * alerts; never leak raw upstream messages with internal codes to buyers.
 */
export function personaErrorCopy(err: unknown): string {
  if (!(err instanceof PayazaError)) return "Something went wrong. Please try again.";
  const code = err.responseCode;
  const msg = (err.responseMessage ?? "").toLowerCase();
  if (msg.includes("insufficient")) return "Not enough funds in the settlement wallet. Try a smaller amount or top up.";
  if (code === "07" || msg.includes("invalid account")) return "That account number was rejected. Check it and try again.";
  if (msg.includes("pin")) return "Payout PIN rejected. Reset it in Payaza dashboard settings.";
  if (msg.includes("whitelist") || msg.includes("ip")) return "This server's IP is not whitelisted for live payouts yet.";
  if (msg.includes("pnd") || msg.includes("post no debit")) return "Payouts are temporarily frozen on the wallet (PND). Contact Payaza support.";
  if (code === "09" || msg.includes("pending")) return "The payment prompt was sent — approve it on your phone.";
  if (err.httpStatus === 401 || err.httpStatus === 403) return "Payaza rejected our credentials. The team has been alerted.";
  if (err.httpStatus >= 500) return "Payaza is having a moment. We'll retry automatically.";
  return err.responseMessage ?? "Payment could not be processed. Please try again.";
}

// ------------------------------------------------------- phone normalization --

/** Kenya/Uganda/Tanzania msisdns: intl format, no '+', exactly 12 digits. */
export function normalizeMsisdn(country: "KE" | "UG" | "TZ", raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  const cc = country === "KE" ? "254" : country === "UG" ? "256" : "255";
  let normalized = digits;
  if (normalized.startsWith(`00${cc}`)) normalized = normalized.slice(2 + cc.length);
  if (normalized.startsWith(cc)) normalized = normalized.slice(cc.length);
  if (normalized.startsWith("0")) normalized = normalized.slice(1);
  const full = `${cc}${normalized}`;
  return /^\d{12}$/.test(full) ? full : null;
}

/** Momo bank codes for MVP corridors (docs codes sheet; KE per research §4.2). */
export const MOMO_BANK_CODES = {
  KE: { mpesa: "SAFKEN", airtel: "AIRTKE" },
  UG: { mtn: "MTNUGX", airtel: "AIRTUGX" },
  TZ: { vodacom: "VODATZ", airtel: "AIRTETZ", tigo: "TIGOTZ", halopesa: "HALOTZ" },
} as const;

export { z, PayazaError };

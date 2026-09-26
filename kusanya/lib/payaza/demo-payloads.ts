/**
 * Demo Mode fixtures (build.md §14, §13).
 *
 * HONESTY NOTE: shapes are VERBATIM from docs.payaza.africa OpenAPI samples and
 * guides_webhooks.md; values are synthetic until real sandbox recordings
 * replace them (scripts/sandbox-smoke.ts --record once test keys arrive).
 * The replay pipeline runs these through the SAME state machine as live
 * webhooks — Demo Mode is a payload source swap, not a parallel fake flow.
 */

import type {
  ProcessCollectionResponse,
  CollectionStatusResponse,
  PayoutResponse,
  CreatePaymentLinkResponse,
  AccountEnquiryResponse,
  CreateSplitAccountResponse,
  CollectionWebhook,
  TransferWebhook,
} from "./types";

export function demoProcessCollectionPending(
  transaction_reference: string,
): ProcessCollectionResponse {
  return {
    response_code: "09",
    response_message: "PENDING",
    transaction_reference,
    redirect_customer_to_url_processing: false,
  };
}

export function demoCollectionStatus(
  transaction_reference: string,
  state: "pending" | "completed" | "failed",
  amount = 1150.0,
  currency = "USD",
): CollectionStatusResponse {
  const base = {
    transaction_reference,
    transaction_amount: amount,
    transaction_fee: state === "completed" ? 21.85 : 0,
    payer_name: "Susan Kamau",
    payer_account_number: "254700000000",
    start_date: new Date().toISOString(),
    end_date: state === "pending" ? "null" : new Date().toISOString(),
    currency,
  };
  if (state === "pending")
    return { ...base, response_code: "09", transaction_status: "Initialized" };
  if (state === "completed")
    return { ...base, response_code: "00", transaction_status: "Completed" };
  return { ...base, response_code: "06", transaction_status: "Failed" };
}

export function demoPayoutInitiated(): PayoutResponse {
  return {
    response_code: 200,
    response_message: "Request successfully submitted",
    response_content: {
      transaction_status: "09",
      narration: "Payout",
      transaction_time: new Date().toISOString(),
      amount: 140113.5,
      response_status: "TRANSACTION_INITIATED",
      response_description:
        "Transaction has been successfully submitted for processing",
    },
    resp_code: "09",
  };
}

export function demoCreatePaymentLink(
  slug: string,
  amount: number,
): CreatePaymentLinkResponse {
  return {
    status: true,
    message: "Payment Link created successfully",
    data: {
      id: 84021,
      link: `https://business.payaza.africa/pay/${slug}`,
      has_fixed_amount: true,
      created_date: new Date().toISOString(),
      business_name: "FreshLeaf Exports Ltd",
      payment_link_name: slug,
      custom_url: slug,
      fee_bearer: "Pay by Business",
      total_collected_amount: 0.0,
      number_of_usage: 0,
      is_single_use: false,
      payment_amount: amount,
    },
  };
}

export function demoAccountEnquiry(): AccountEnquiryResponse {
  return {
    message: "Account enquiry response",
    status: true,
    data: [
      {
        id: 1,
        accountName: "FreshLeaf Exports Ltd",
        payazaAccountReference: "1010000001",
        status: "ACTIVE",
        accountBalance: 245113.5,
        currency: "KES",
        country: "KEN",
        productCode: "PAYOUT-MAIN-KES",
        postNoCredit: false,
        postNoDebit: false,
      },
      {
        id: 2,
        accountName: "FreshLeaf Exports Ltd",
        payazaAccountReference: "1020000002",
        status: "ACTIVE",
        accountBalance: 4820.55,
        currency: "USD",
        country: "USA",
        productCode: "PAYOUT-MAIN-USD",
        postNoCredit: false,
        postNoDebit: false,
      },
    ],
  };
}

export function demoCreateSplitAccount(): CreateSplitAccountResponse {
  return {
    code: "00",
    success: true,
    error: null,
    data: { code: "SSA_C0900E891783950401871", id: 114 },
    message: "split account created successfully",
  };
}

/** Kenyan bank/momo codes excerpt (docs codes sheet; cached 24h in live). */
export function demoBankCodesKE() {
  return {
    status: true,
    message: " Banks Fetched Successfully ",
    data: [
      { bankName: "SAFARICOM MPESA", bankCode: "SAFKEN" },
      { bankName: "AIRTEL KENYA", bankCode: "AIRTKE" },
      { bankName: "EQUITY BANK KENYA", bankCode: "000018" },
      { bankName: "KCB BANK KENYA", bankCode: "000012" },
      { bankName: "CO-OPERATIVE BANK KENYA", bankCode: "000008" },
    ],
  };
}

// ------------------------------------------------------------ webhook events --

export function demoWebhookCollectionSuccess(opts: {
  merchant_reference: string;
  transaction_reference?: string;
  amount: number;
  fee?: number;
  currency: string;
  channel?: string;
  amount_validation?: "EXACT" | "UNDERPAYMENT" | "OVERPAYMENT";
}): CollectionWebhook {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  return {
    transaction_reference: opts.transaction_reference ?? `PZ${Date.now()}`,
    transaction_status: "Funds Received",
    virtual_account_number: "",
    transaction_fee: opts.fee ?? Math.round(opts.amount * 0.019 * 100) / 100,
    amount_received: opts.amount,
    initiated_date: now,
    current_status_date: now,
    received_from: {
      account_name: "Susan Kamau",
      account_number: "5274****1019",
      bank_name: "N/A",
    },
    merchant_reference: opts.merchant_reference,
    status: "Completed",
    status_reason: "Payment Approved",
    session_id: String(Date.now()),
    channel: opts.channel ?? "Card",
    branch: false,
    currency_code: opts.currency,
    business_fk: 1010,
    customer: {
      email_address: "susan@dubaifresh.ae",
      first_name: "Susan",
      last_name: "Kamau",
      mobile_number: "971501234567",
    },
    request_amount: opts.amount,
    amount_validation: opts.amount_validation ?? "EXACT",
  } as CollectionWebhook;
}

export function demoWebhookCollectionFailed(
  merchant_reference: string,
  currency = "USD",
): CollectionWebhook {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  return {
    transaction_reference: `PZ${Date.now()}`,
    transaction_status: "Transaction Failed",
    transaction_fee: 0,
    amount_received: 0,
    initiated_date: now,
    current_status_date: now,
    merchant_reference,
    status: "Failed",
    status_reason: "Card Declined",
    channel: "Card",
    currency_code: currency,
    request_amount: 1150,
    amount_validation: "EXACT",
  } as CollectionWebhook;
}

export function demoWebhookMomoKESCollection(
  merchant_reference: string,
  amountKes: number,
): CollectionWebhook {
  return demoWebhookCollectionSuccess({
    merchant_reference,
    amount: amountKes,
    fee: Math.round(amountKes * 0.014 * 100) / 100,
    currency: "KES",
    channel: "KENYA_COLLECTIONS",
  });
}

export function demoWebhookPayoutSuccess(ourReference: string): TransferWebhook {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  return {
    narration: ourReference,
    transaction_reference: `PTSA${Date.now()}`,
    transaction_type: "DEBIT",
    transaction_status: "NIP_SUCCESS",
    transaction_fee: 15.0,
    amount_received: 140113.5,
    sent_to: {
      account_name: "Wanjiru FreshLeaf",
      account_number: "254700111222",
      bank_name: "SAFARICOM MPESA",
    },
    initiated_date: now,
    current_status_date: now,
    is_reversed: false,
    response_message: "Approved or Completely Successful",
    response_code: "00",
    currency: "KES",
    country: "KEN",
    session_id: String(Date.now()),
  };
}

export function demoWebhookPayoutFailed(ourReference: string): TransferWebhook {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  return {
    narration: ourReference,
    transaction_reference: `PTSA${Date.now()}`,
    transaction_type: "DEBIT",
    transaction_status: "NIP_FAILURE",
    transaction_fee: 0,
    amount_received: 0,
    sent_to: {
      account_name: "Wanjiru FreshLeaf",
      account_number: "254700111222",
      bank_name: "SAFARICOM MPESA",
    },
    initiated_date: now,
    current_status_date: now,
    is_reversed: true,
    response_message: "Invalid Account",
    response_code: "07",
    currency: "KES",
    country: "KEN",
  };
}

/**
 * Deterministic demo delay: live API feel without venue-Wi-Fi dependency.
 * Applied by the demo client wrapper only.
 */
export const DEMO_LATENCY_MS = { fast: 120, prompt: 900, webhook: 1500 };

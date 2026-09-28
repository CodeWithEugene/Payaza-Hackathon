import { z } from "zod";
import { CURRENCY_CODES } from "@/lib/money/currencies";

/**
 * Zod schemas for every Payaza boundary (build.md §5 principle: typed
 * end-to-end). Shapes verified against docs.payaza.africa OpenAPI + guides
 * (research.md §4). Wire amounts are MAJOR units (numbers) — convert to minor
 * via lib/money at the boundary.
 */

// ------------------------------------------------------------- primitives --

export const currencyCodeSchema = z.enum(
  CURRENCY_CODES as [string, ...string[]],
);

/** ISO 3166-1 alpha-2 countries Payaza momo collections support (KE MVP). */
export const momoCountrySchema = z.enum(["KE", "UG", "TZ", "GH", "NG"]);

/** ISO 3166-1 alpha-3 for link/split APIs. */
export const countryAlpha3Schema = z.enum(["KEN", "UGA", "TZA", "NGA", "GHA", "USA"]);

/** Momo msisdn: 12 digits incl. country code, no '+' (docs: KE/UG/TZ). */
export const msisdnSchema = z
  .string()
  .regex(/^\d{12}$/, "mobile money number must be 12 digits (e.g. 2547XXXXXXXX)");

export const merchantReferenceSchema = z
  .string()
  .min(6)
  .max(40)
  .regex(/^[A-Za-z0-9-]+$/);

// --------------------------------------------------- momo process-collection --

export const processCollectionRequestSchema = z.object({
  amount: z.number().positive(),
  customer_number: msisdnSchema,
  transaction_reference: merchantReferenceSchema,
  transaction_description: z.string().min(1).max(140),
  /** KE: SAFKEN (Safaricom M-Pesa); see codes sheet in docs. */
  customer_bank_code: z.string().min(2).max(16),
  currency_code: z.string().length(3),
  customer_email: z.string().email(),
  customer_first_name: z.string().min(1),
  customer_last_name: z.string().min(1),
  customer_phone_number: z.string().min(6).max(16),
  country_code: momoCountrySchema,
});
export type ProcessCollectionRequest = z.infer<
  typeof processCollectionRequestSchema
>;

/** 09/PENDING = prompt sent to customer — the EXPECTED happy-path response. */
export const processCollectionResponseSchema = z.object({
  response_code: z.string(),
  response_message: z.string(),
  transaction_reference: z.string().optional(),
  requires_otp: z.boolean().nullish(),
  otp_length: z.number().int().nullish(),
  before_payment_instruction: z.string().nullish(),
  after_payment_instruction: z.string().nullish(),
  payment_token: z.string().nullish(),
  payee: z.string().nullish(),
  payment_method: z.string().nullish(),
  transaction_channel: z.string().nullish(),
  redirect_customer_to_url_processing: z.boolean().nullish(),
  payment_completion_url: z.string().nullish(),
});
export type ProcessCollectionResponse = z.infer<
  typeof processCollectionResponseSchema
>;

// ---------------------------------------------------- collection status query --

/**
 * GET /subsidiary/collections/v1/check-status — FLAT response (no envelope).
 * response_code "09" → prompt pending; "00" → completed.
 */
export const collectionStatusResponseSchema = z.object({
  response_code: z.string(),
  transaction_reference: z.string().optional(),
  transaction_amount: z.number().nullish(),
  transaction_fee: z.number().nullish(),
  transaction_status: z.string().nullish(), // Initialized | Completed | Failed
  payer_name: z.string().nullish(),
  payer_account_number: z.string().nullish(),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
  currency: z.string().nullish(),
});
export type CollectionStatusResponse = z.infer<
  typeof collectionStatusResponseSchema
>;

// --------------------------------------------------------- card (USD) charge --

export const cardChargeRequestSchema = z.object({
  card_number: z.string().min(12).max(19),
  expiry: z.string().regex(/^\d{2}\/\d{2}$/, "expiry must be MM/YY"),
  cvv: z.string().min(3).max(4),
  amount: z.number().positive(),
  currency: z.string().length(3),
  merchant_reference: merchantReferenceSchema,
  customer_email: z.string().email().optional(),
  customer_name: z.string().optional(),
  country: z.string().length(3).optional(),
  capture_now: z.boolean().optional(),
});
export type CardChargeRequest = z.infer<typeof cardChargeRequestSchema>;

export const cardChargeResponseSchema = z
  .object({
    code: z.union([z.string(), z.number()]).optional(),
    message: z.string().optional(),
    status: z.boolean().optional(),
    data: z
      .object({
        response_code: z.string().optional(),
        response_message: z.string().optional(),
        transaction_reference: z.string().optional(),
        status: z.string().optional(),
        redirect_url: z.string().optional(), // 3DS challenge
        amount: z.number().optional(),
        currency: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();
export type CardChargeResponse = z.infer<typeof cardChargeResponseSchema>;

// ------------------------------------------------- apple pay / google pay ----

export const mobilePaymentInitiateRequestSchema = z
  .object({
    payment_data: z.string(), // base64/JSON token from wallet
    amount: z.number().positive(),
    currency: z.string().length(3),
    transaction_reference: merchantReferenceSchema,
    customer_email: z.string().email().optional(),
  })
  .passthrough();

export const mobilePaymentInitiateResponseSchema = z
  .object({
    response_code: z.string().optional(),
    response_message: z.string().optional(),
    transaction_reference: z.string().optional(),
  })
  .passthrough();

// ---------------------------------------------------------- payment links ----

export const createPaymentLinkRequestSchema = z.object({
  payment_link_name: z.string().min(1).max(120),
  payment_description: z.string().max(250).optional(),
  has_fixed_amount: z.boolean(),
  payment_amount: z.number().positive().optional(), // required when fixed
  country_code: countryAlpha3Schema,
  currency_code: z.string().length(3), // USD|KES per research §4.2
  custom_url: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(60)
    .optional(),
  collect_customer_first_and_last_name: z.boolean().optional(),
  collect_customer_email: z.boolean().optional(),
  collect_customer_phone_number: z.boolean().optional(),
  redirect_url: z.string().url().optional(),
  /** "Business" | "Customer" — who absorbs processing fees. */
  fee_bearer_type: z.enum(["Business", "Customer"]),
  payment_link_image: z.string().url().optional(),
});
export type CreatePaymentLinkRequest = z.infer<
  typeof createPaymentLinkRequestSchema
>;

export const createPaymentLinkResponseSchema = z.object({
  status: z.boolean(),
  message: z.string(),
  data: z
    .object({
      id: z.union([z.number(), z.string()]),
      link: z.string().url(), // https://business.payaza.africa/pay/<slug>
      has_fixed_amount: z.boolean().optional(),
      created_date: z.string().optional(),
      business_name: z.string().optional(),
      payment_link_name: z.string().optional(),
      custom_url: z.string().optional(),
      fee_bearer: z.string().optional(),
      total_collected_amount: z.number().optional(),
      number_of_usage: z.number().optional(),
      is_single_use: z.boolean().optional(),
    })
    .passthrough(),
});
export type CreatePaymentLinkResponse = z.infer<
  typeof createPaymentLinkResponseSchema
>;

/** Fetch links/transactions — reconciliation only; passthrough (shape varies). */
export const looseEnvelopeSchema = z
  .object({
    status: z.boolean().optional(),
    code: z.union([z.string(), z.number()]).optional(),
    message: z.string().optional(),
    data: z.unknown(),
  })
  .passthrough();

// ---------------------------------------------------------------- payouts ----

export const payoutSenderSchema = z.object({
  sender_name: z.string().min(1),
  sender_id: z.string().optional(),
  sender_phone_number: z.string().min(6).max(16),
  sender_address: z.string().min(1),
  dial_code: z.string().optional(),
});

export const payoutBeneficiarySchema = z.object({
  credit_amount: z.number().positive(),
  /** M-Pesa: msisdn (12-digit); kepss: bank account number. */
  account_number: z.string().min(6).max(40),
  account_name: z.string().min(1).max(160),
  /** M-Pesa bank code (SAFKEN…) or kepss bank code. */
  bank_code: z.string().min(2).max(16),
  narration: z.string().max(140),
  transaction_reference: merchantReferenceSchema,
  sender: payoutSenderSchema,
});

export const payoutRequestSchema = z.object({
  /** KES: "mobile_money" | "kepss" · UGX/TZS: "mobile_money". */
  transaction_type: z.enum(["mobile_money", "kepss", "nuban", "ghipps", "tiss"]),
  service_payload: z.object({
    payout_amount: z.number().positive(),
    /** Live only — 6-digit dashboard PIN (never stored; env-injected). */
    transaction_pin: z.number().int().optional(),
    /** KES wallet's payazaAccountReference (from account enquiry). */
    account_reference: z.string().min(4),
    currency: z.string().length(3),
    country: countryAlpha3Schema,
    payout_beneficiaries: z.array(payoutBeneficiarySchema).min(1),
  }),
});
export type PayoutRequest = z.infer<typeof payoutRequestSchema>;

export const payoutResponseSchema = z.object({
  response_code: z.union([z.number(), z.string()]),
  response_message: z.string().optional(),
  response_content: z
    .object({
      transaction_status: z.string().optional(), // "09"
      narration: z.string().optional(),
      transaction_time: z.string().optional(),
      amount: z.number().optional(),
      response_status: z.string().optional(), // TRANSACTION_INITIATED
      response_description: z.string().optional(),
      batch_reference: z.string().optional(),
      message: z.string().optional(),
      response_code: z.union([z.string(), z.number()]).optional(),
    })
    .passthrough()
    .optional(),
  resp_code: z.string().optional(),
});
export type PayoutResponse = z.infer<typeof payoutResponseSchema>;

/** Payout/transfer status — passthrough (enquiry envelope varies by rail). */
export const payoutStatusResponseSchema = z
  .object({
    message: z.string().optional(),
    status: z.boolean().optional(),
    response_code: z.union([z.string(), z.number()]).optional(),
    data: z.unknown(),
  })
  .passthrough();

// ------------------------------------------------------------ accounts -------

export const accountEnquiryResponseSchema = z.object({
  message: z.string().optional(),
  status: z.boolean(),
  data: z.array(
    z
      .object({
        id: z.union([z.number(), z.string()]),
        accountName: z.string().optional(),
        /** The account_reference used for payouts from this wallet. */
        payazaAccountReference: z.string(),
        status: z.string().optional(), // ACTIVE
        accountBalance: z.number(), // major units
        currency: z.string().length(3),
        country: z.string().optional(),
        productCode: z.string().optional(), // PAYOUT-MAIN-KES …
        /** Post-No-Debit flag — true blocks payouts (research §4.3). */
        postNoDebit: z.boolean().optional(),
        postNoCredit: z.boolean().optional(),
      })
      .passthrough(),
  ),
});
export type AccountEnquiryResponse = z.infer<typeof accountEnquiryResponseSchema>;

export const bankCodesResponseSchema = z
  .object({
    message: z.string().optional(),
    status: z.boolean().optional(),
    data: z.unknown(), // [{bankName, bankCode…}] — passthrough, cached 24h
  })
  .passthrough();

// --------------------------------------------------------- split accounts ----

export const createSplitAccountRequestSchema = z.object({
  account_no: z.string().min(4).max(40),
  account_name: z.string().min(1).max(160),
  bank_code: z.string().min(2).max(16),
  name: z.string().min(1).max(120),
  email: z.string().email(),
  currency: z.string().length(3), // KES for KE beneficiaries (R2 fallback risk)
  country: countryAlpha3Schema,
  split_type: z.enum(["PERCENTAGE", "FLAT"]),
  /**
   * ⚠️ INVERTED SEMANTICS (research §4.4): percentage/flat allocated to the
   * PAYAZA ACCOUNT OWNER (platform keep) — beneficiary receives the rest.
   */
  split_value: z.number().min(0).max(100),
});
export type CreateSplitAccountRequest = z.infer<
  typeof createSplitAccountRequestSchema
>;

export const createSplitAccountResponseSchema = z.object({
  code: z.union([z.string(), z.number()]),
  success: z.boolean(),
  error: z.string().nullish(),
  data: z
    .object({
      code: z.string(), // SSA_… — goes into Checkout SDK split_accounts
      id: z.union([z.number(), z.string()]), // needed for update/delete
    })
    .passthrough(),
  message: z.string().optional(),
});
export type CreateSplitAccountResponse = z.infer<
  typeof createSplitAccountResponseSchema
>;

// --------------------------------------------------------------- refunds -----

export const refundRequestSchema = z
  .object({
    transaction_reference: z.string(),
    refund_amount: z.number().positive().optional(), // omit/partial per docs
    reason: z.string().optional(),
    customer_email: z.string().email().optional(),
  })
  .passthrough();

// ------------------------------------------------------------- webhooks ------

/** Collection webhook (guides_webhooks.md sample — fields verbatim). */
export const collectionWebhookSchema = z.object({
  transaction_reference: z.string(),
  transaction_status: z.enum(["Funds Received", "Transaction Failed"]),
  virtual_account_number: z.string().nullish(),
  transaction_fee: z.number(),
  amount_received: z.number(),
  initiated_date: z.string().nullish(),
  current_status_date: z.string().nullish(),
  received_from: z
    .object({
      account_name: z.string().nullish(),
      account_number: z.string().nullish(),
      bank_name: z.string().nullish(),
    })
    .nullish(),
  merchant_reference: z.string().nullish(), // OURS (VA & Checkout flows)
  status: z.enum(["Completed", "Failed"]).nullish(),
  status_reason: z.string().nullish(),
  session_id: z.string().nullish(),
  channel: z.string().nullish(), // KENYA_COLLECTIONS | Card | Apple Pay …
  currency_code: z.string().nullish(),
  customer: z
    .object({
      email_address: z.string().nullish(),
      first_name: z.string().nullish(),
      last_name: z.string().nullish(),
      mobile_number: z.string().nullish(),
    })
    .nullish(),
  request_amount: z.number().nullish(),
  amount_validation: z.enum(["EXACT", "UNDERPAYMENT", "OVERPAYMENT"]).nullish(),
});
export type CollectionWebhook = z.infer<typeof collectionWebhookSchema>;

/** Transfer/payout webhook (NIP_* statuses). */
export const transferWebhookSchema = z.object({
  transaction_reference: z.string(), // Payaza's ref (PTSA…) — match via narration/ledger
  narration: z.string().nullish(), // often carries OUR reference
  transaction_type: z.string().nullish(), // DEBIT
  transaction_status: z.enum([
    "NIP_SUCCESS",
    "NIP_FAILURE",
    "NIP_PENDING",
    "ESCROW_SUCCESS",
    "TRANSACTION_INITIATED",
  ]),
  transaction_fee: z.number().nullish(),
  amount_received: z.number().nullish(),
  sent_to: z
    .object({
      account_name: z.string().nullish(),
      account_number: z.string().nullish(),
      bank_name: z.string().nullish(),
    })
    .nullish(),
  initiated_date: z.string().nullish(),
  current_status_date: z.string().nullish(),
  is_reversed: z.boolean().nullish(),
  response_message: z.string().nullish(),
  response_code: z.string().nullish(),
  currency: z.string().nullish(),
  country: z.string().nullish(),
  session_id: z.string().nullish(),
});
export type TransferWebhook = z.infer<typeof transferWebhookSchema>;

/** Checkout-SDK client callback (a HINT — always re-verified server-side). */
export const checkoutCallbackSchema = z
  .object({
    status: z.union([z.string(), z.boolean(), z.number()]).optional(),
    transaction_reference: z.string().optional(),
    merchant_reference: z.string().optional(),
    payment_reference: z.string().optional(),
    amount: z.number().optional(),
    currency: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();
export type CheckoutCallback = z.infer<typeof checkoutCallbackSchema>;

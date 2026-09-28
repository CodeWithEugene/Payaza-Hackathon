import type { ErrorCode } from "@/lib/api/v1/envelope";
import { DEFAULT_LIMIT, MAX_LIMIT } from "@/lib/api/v1/schemas";

/**
 * Single source of truth for the API v1 reference: the /developers page
 * renders it and lib/api/v1/openapi.ts turns it into OpenAPI 3.1. Examples
 * mirror real responses from this codebase's serializers.
 */

export type ParamType = "string" | "integer" | "boolean" | "number" | "object" | "array";

export interface ParamDoc {
  name: string;
  type: ParamType;
  required?: boolean;
  description: string;
  enum?: readonly string[];
  default?: string | number | boolean;
}

export interface EndpointDoc {
  id: string;
  operationId: string;
  tag: "Invoices" | "Extraction" | "Payments" | "Buyers" | "Meta";
  method: "GET" | "POST";
  path: string;
  title: string;
  summary: string;
  description: string[];
  auth: boolean;
  pathParams?: ParamDoc[];
  queryParams?: ParamDoc[];
  bodyParams?: ParamDoc[];
  requestSchema?: string;
  requestExample?: unknown;
  /** Sample path id and query string used in the generated code samples. */
  exampleId?: string;
  exampleQuery?: string;
  responseStatus: 200 | 201;
  responseSchema: string;
  responseList?: boolean;
  responseExample: unknown;
  errors: ErrorCode[];
}

const INVOICE_STATUSES = [
  "draft",
  "ready",
  "sent",
  "partially_paid",
  "paid",
  "settling",
  "settled",
  "paying_out",
  "completed",
  "failed",
  "cancelled",
  "review",
  "on_hold",
] as const;

const EXAMPLE_INVOICE = {
  id: "inv_01k6c3v9r8x2m4n6p8q0s2t4v6",
  object: "invoice",
  number: "KSN-2026-0007",
  status: "sent",
  currency: "USD",
  amount_minor: "115000",
  amount_paid_minor: "0",
  fee_bearer: "business",
  buyer: { id: "buy_01k6c3v9r2a4c6e8g0j2l4n6p8", name: "Dubai Fresh FZE", country: "AE" },
  due_at: "2026-10-15T00:00:00.000Z",
  issued_at: "2026-09-28T09:12:44.120Z",
  notes: "French beans, air freight JKIA to DXB.",
  pay_url: "https://kusanya.example/i/tok_01k6c3v9r8y3n5p7r9t1v3x5z7",
  payment_link_url: "https://business.payaza.africa/pay/ksn-2026-0007",
  risk: { decision: "pass", score: 12 },
  created_at: "2026-09-28T09:12:41.004Z",
  updated_at: "2026-09-28T09:12:44.120Z",
};

const EXAMPLE_PAYMENT = {
  id: "txn_01k6c4a1b2c3d4e5f6g7h8j9k0",
  object: "payment",
  invoice_id: "inv_01k6c3v9r8x2m4n6p8q0s2t4v6",
  kind: "collection",
  direction: "in",
  channel: "card",
  status: "completed",
  currency: "USD",
  amount_minor: "115000",
  fee_minor: "2185",
  net_minor: "112815",
  merchant_reference: "KSN-01K6C4A1B2C3D4E5F6G7H8J9K0",
  payaza_reference: "PZ9012345678",
  occurred_at: "2026-09-29T14:03:10.000Z",
  created_at: "2026-09-29T14:02:51.337Z",
};

const EXAMPLE_BUYER = {
  id: "buy_01k6c3v9r2a4c6e8g0j2l4n6p8",
  object: "buyer",
  name: "Dubai Fresh FZE",
  kind: "company",
  email: "susan@dubaifresh.ae",
  phone: "+971501234567",
  country: "AE",
  created_at: "2026-08-21T07:30:00.000Z",
};

const PAGINATION_PARAMS: ParamDoc[] = [
  { name: "page", type: "integer", description: "Page number, starting at 1.", default: 1 },
  {
    name: "limit",
    type: "integer",
    description: `Items per page, between 1 and ${MAX_LIMIT}.`,
    default: DEFAULT_LIMIT,
  },
];

const ID_PARAM: ParamDoc = {
  name: "id",
  type: "string",
  required: true,
  description: "The invoice id, for example `inv_01k6c3v9r8x2m4n6p8q0s2t4v6`.",
};

export const ENDPOINTS: EndpointDoc[] = [
  {
    id: "list-invoices",
    operationId: "listInvoices",
    tag: "Invoices",
    method: "GET",
    path: "/invoices",
    exampleQuery: "?status=sent,partially_paid&limit=10",
    title: "List Invoices",
    summary: "List the invoices of your business, newest first.",
    description: [
      "Returns invoices for the business that owns the API key, ordered by creation time with the newest first.",
      "Filter by one or more statuses with a comma separated list, for example `status=sent,partially_paid`.",
    ],
    auth: true,
    queryParams: [
      {
        name: "status",
        type: "string",
        description: "Comma separated invoice statuses to include.",
        enum: INVOICE_STATUSES,
      },
      ...PAGINATION_PARAMS,
    ],
    responseStatus: 200,
    responseSchema: "Invoice",
    responseList: true,
    responseExample: {
      data: [EXAMPLE_INVOICE],
      error: null,
      pagination: { page: 1, limit: 25, total: 1, has_more: false },
    },
    errors: ["validation_error", "unauthorized", "key_revoked", "rate_limited"],
  },
  {
    id: "create-invoice",
    operationId: "createInvoice",
    tag: "Invoices",
    method: "POST",
    path: "/invoices",
    title: "Create An Invoice",
    summary: "Create an invoice, screen it for risk and generate its Payaza payment link.",
    description: [
      "Creates the invoice through the same pipeline as the Kusanya dashboard: the invoice is saved, screened for risk, and when the screen passes it gets a Payaza payment link and moves to `ready`.",
      "Set `send` to true to also email and text the buyer their pay link right away, which moves the invoice to `sent`.",
      "When the risk screen returns review or hold, the invoice waits in the dashboard risk queue with status `review` or `on_hold`. Nothing is sent and `payment_link_url` stays null. Once someone approves it in the dashboard, Send An Invoice creates the payment link and delivers it.",
      "The invoice total is the sum of `quantity` multiplied by `unit_price_minor` over all line items, rounded to the nearest minor unit per line.",
    ],
    auth: true,
    bodyParams: [
      {
        name: "buyer",
        type: "object",
        required: true,
        description:
          "Either `{ id }` of an existing buyer, or a new buyer: `{ name, email?, phone?, country?, kind? }`. `country` is a two letter ISO code (default KE) and `kind` is company or person (default company). When `id` is present the other buyer fields are ignored.",
      },
      {
        name: "currency",
        type: "string",
        required: true,
        description: "Invoice currency.",
        enum: ["USD", "KES", "UGX", "TZS"],
      },
      {
        name: "line_items",
        type: "array",
        required: true,
        description:
          "1 to 50 items of `{ description, quantity, unit_price_minor }`. `quantity` is a positive number with at most two decimals.",
      },
      { name: "due_date", type: "string", description: "Due date as `2026-10-15` or a full ISO 8601 date-time." },
      { name: "notes", type: "string", description: "Free text shown on the invoice, up to 2000 characters." },
      {
        name: "fee_bearer",
        type: "string",
        description: "Who absorbs the Payaza processing fee.",
        enum: ["business", "customer"],
        default: "business",
      },
      {
        name: "extraction_id",
        type: "string",
        description: "Optional id from Extract Invoice Fields. Its source text is included in the risk screen.",
      },
      {
        name: "send",
        type: "boolean",
        description: "Send the invoice to the buyer immediately when the risk screen passes.",
        default: false,
      },
    ],
    requestSchema: "CreateInvoiceRequest",
    requestExample: {
      buyer: { name: "Dubai Fresh FZE", email: "susan@dubaifresh.ae", country: "AE" },
      currency: "USD",
      line_items: [{ description: "French beans (kg)", quantity: 500, unit_price_minor: "230" }],
      due_date: "2026-10-15",
      notes: "French beans, air freight JKIA to DXB.",
      send: true,
    },
    responseStatus: 201,
    responseSchema: "InvoiceDetail",
    responseExample: {
      data: {
        ...EXAMPLE_INVOICE,
        line_items: [
          { description: "French beans (kg)", quantity: "500", unit_price_minor: "230", currency: "USD" },
        ],
        payments: [],
      },
      error: null,
    },
    errors: ["validation_error", "invalid_json", "unauthorized", "key_revoked", "not_found", "rate_limited", "upstream_error"],
  },
  {
    id: "retrieve-invoice",
    operationId: "getInvoice",
    tag: "Invoices",
    method: "GET",
    path: "/invoices/{id}",
    title: "Retrieve An Invoice",
    summary: "Fetch one invoice with its line items and payments.",
    description: [
      "Returns the invoice with its line items and every ledger entry recorded against it (collections, payouts, refunds and splits).",
      "Invoices that belong to another business return 404, exactly like ids that do not exist.",
    ],
    auth: true,
    pathParams: [ID_PARAM],
    responseStatus: 200,
    responseSchema: "InvoiceDetail",
    responseExample: {
      data: {
        ...EXAMPLE_INVOICE,
        status: "paid",
        amount_paid_minor: "115000",
        line_items: [
          { description: "French beans (kg)", quantity: "500", unit_price_minor: "230", currency: "USD" },
        ],
        payments: [EXAMPLE_PAYMENT],
      },
      error: null,
    },
    errors: ["unauthorized", "key_revoked", "not_found", "rate_limited"],
  },
  {
    id: "send-invoice",
    operationId: "sendInvoice",
    tag: "Invoices",
    method: "POST",
    path: "/invoices/{id}/send",
    title: "Send An Invoice",
    summary: "Email and text the buyer their pay link.",
    description: [
      "Delivers the invoice to the buyer by email (when the buyer has an email) and SMS (when the buyer has a phone), then moves a ready invoice to sent and schedules payment reminders.",
      "Invoices in `ready`, `sent` or `partially_paid` can be sent. Sending a sent or partially paid invoice delivers the notification again. Any other status returns 409 `invalid_state`.",
      "No request body is needed.",
    ],
    auth: true,
    pathParams: [ID_PARAM],
    responseStatus: 200,
    responseSchema: "InvoiceDetail",
    responseExample: {
      data: {
        ...EXAMPLE_INVOICE,
        line_items: [
          { description: "French beans (kg)", quantity: "500", unit_price_minor: "230", currency: "USD" },
        ],
        payments: [],
      },
      error: null,
    },
    errors: ["unauthorized", "key_revoked", "not_found", "invalid_state", "rate_limited", "upstream_error"],
  },
  {
    id: "extract",
    operationId: "extractInvoiceFields",
    tag: "Extraction",
    method: "POST",
    path: "/extract",
    title: "Extract Invoice Fields",
    summary: "Turn a pasted chat order into structured invoice fields.",
    description: [
      "Runs the same AI extraction as the dashboard invoice wizard (TypeSafe Jev) over the text of a chat order, such as a WhatsApp message.",
      "Every field comes with a confidence between 0 and 1 and, where available, the snippet of source text that supports it. Treat values below 0.6 as needing human review.",
      "This endpoint creates no invoice and no buyer. It records the extraction for your audit trail and returns an `extraction_id` you can pass to Create An Invoice.",
      "`buyer.matched_buyer_id` is set when the buyer matches someone already in your directory. Fields the model could not find come back with a null value and a confidence of 0.",
      "`model` names the TypeSafe Jev model version that answered. When TypeSafe is not configured or does not answer in time, extraction falls back to deterministic rules and reports `demo-rules-v1`.",
    ],
    auth: true,
    bodyParams: [
      {
        name: "text",
        type: "string",
        required: true,
        description: "The order text, between 3 and 20000 characters.",
      },
    ],
    requestSchema: "ExtractRequest",
    requestExample: {
      text: "Hi Wanjiru, please send 500kg French beans at $2.30/kg for Dubai Fresh FZE. Need them by 15 Oct. Thanks, Susan",
    },
    responseStatus: 200,
    responseSchema: "Extraction",
    responseExample: {
      data: {
        extraction_id: "ext_01k6c5d7f9h1k3m5p7r9t1w3y5",
        object: "extraction",
        model: "jev-1.13.0",
        quality: 0.91,
        duration_ms: 1840,
        buyer: {
          value: "Dubai Fresh FZE",
          confidence: 0.94,
          snippet: "for Dubai Fresh FZE",
          matched_buyer_id: "buy_01k6c3v9r2a4c6e8g0j2l4n6p8",
        },
        currency: { value: "USD", confidence: 0.9, snippet: "$2.30/kg" },
        total: { value: "115000", confidence: 0.88, snippet: "500kg French beans at $2.30/kg" },
        due_date: { value: "2026-10-15", confidence: 0.82, snippet: "by 15 Oct" },
        firm_order: { value: true, confidence: 0.87, snippet: "please send 500kg" },
        line_items: [
          {
            description: "French beans",
            quantity: 500,
            unit_price_minor: "230",
            currency: "USD",
            confidence: 0.9,
          },
        ],
      },
      error: null,
    },
    errors: ["validation_error", "invalid_json", "unauthorized", "key_revoked", "rate_limited"],
  },
  {
    id: "list-payments",
    operationId: "listPayments",
    tag: "Payments",
    method: "GET",
    path: "/payments",
    exampleQuery: "?invoice_id=inv_01k6c3v9r8x2m4n6p8q0s2t4v6&kind=collection",
    title: "List Payments",
    summary: "Read the transactions ledger: collections in, payouts out.",
    description: [
      "Returns ledger entries for your business, newest first. Collections are money in from buyers (card or mobile money), payouts are money out to your M-Pesa or bank account.",
      "Payment statuses follow Payaza: `initialized`, `pending`, `completed`, `failed`, `reversed` and `escrow`.",
    ],
    auth: true,
    queryParams: [
      { name: "invoice_id", type: "string", description: "Only entries recorded against this invoice." },
      {
        name: "kind",
        type: "string",
        description: "Only entries of this kind.",
        enum: ["collection", "payout", "refund", "split"],
      },
      {
        name: "status",
        type: "string",
        description: "Only entries in this status.",
        enum: ["initialized", "pending", "completed", "failed", "reversed", "escrow"],
      },
      ...PAGINATION_PARAMS,
    ],
    responseStatus: 200,
    responseSchema: "Payment",
    responseList: true,
    responseExample: {
      data: [EXAMPLE_PAYMENT],
      error: null,
      pagination: { page: 1, limit: 25, total: 1, has_more: false },
    },
    errors: ["validation_error", "unauthorized", "key_revoked", "rate_limited"],
  },
  {
    id: "list-buyers",
    operationId: "listBuyers",
    tag: "Buyers",
    method: "GET",
    path: "/buyers",
    exampleQuery: "?limit=50",
    title: "List Buyers",
    summary: "List the buyers in your directory, newest first.",
    description: [
      "Buyers are created by the dashboard wizard or by Create An Invoice with a new buyer object. Use a buyer id to invoice the same buyer again.",
    ],
    auth: true,
    queryParams: PAGINATION_PARAMS,
    responseStatus: 200,
    responseSchema: "Buyer",
    responseList: true,
    responseExample: {
      data: [EXAMPLE_BUYER],
      error: null,
      pagination: { page: 1, limit: 25, total: 1, has_more: false },
    },
    errors: ["validation_error", "unauthorized", "key_revoked", "rate_limited"],
  },
  {
    id: "openapi",
    operationId: "getOpenApiDocument",
    tag: "Meta",
    method: "GET",
    path: "/openapi.json",
    title: "OpenAPI Document",
    summary: "The machine readable OpenAPI 3.1 description of this API.",
    description: [
      "Public, no API key needed. Import it into Postman, Insomnia or an OpenAPI code generator.",
    ],
    auth: false,
    responseStatus: 200,
    responseSchema: "OpenApiDocument",
    responseExample: { openapi: "3.1.0", info: { title: "Kusanya API", version: "1.0.0" }, paths: {} },
    errors: [],
  },
];

export interface ErrorDoc {
  code: ErrorCode;
  status: number;
  meaning: string;
}

export const ERROR_DOCS: ErrorDoc[] = [
  { code: "validation_error", status: 400, meaning: "A parameter or body field is missing or invalid. See `error.details` for each field." },
  { code: "invalid_json", status: 400, meaning: "The request body is not valid JSON." },
  { code: "unauthorized", status: 401, meaning: "The Authorization header is missing, or the key is not a valid Kusanya key." },
  { code: "key_revoked", status: 401, meaning: "The key was revoked in the dashboard. Create a new one." },
  { code: "not_found", status: 404, meaning: "No such invoice or buyer exists for your business." },
  { code: "invalid_state", status: 409, meaning: "The invoice status does not allow this action, for example sending an invoice held for review." },
  { code: "rate_limited", status: 429, meaning: "Too many requests. Wait for the number of seconds in the Retry-After header." },
  {
    code: "upstream_error",
    status: 502,
    meaning:
      "Payaza did not respond as expected. Retrying Send An Invoice is safe. If it happens on Create An Invoice, the invoice may already exist in draft, so list your invoices before retrying.",
  },
  { code: "internal_error", status: 500, meaning: "Something failed on our side. The response never includes internal details." },
];

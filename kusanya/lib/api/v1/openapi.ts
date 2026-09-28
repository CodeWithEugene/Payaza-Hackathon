import { ENDPOINTS, ERROR_DOCS, type EndpointDoc, type ParamDoc } from "@/lib/developers/endpoints";
import { ERROR_CODES } from "./envelope";
import { CURRENCY_VALUES, INVOICE_STATUS_VALUES, MAX_LIMIT, PAYMENT_KIND_VALUES, PAYMENT_STATUS_VALUES } from "./schemas";
import { RATE_LIMITS_DOC } from "./limits";

/**
 * OpenAPI 3.1 document for the public API v1, generated from the same
 * endpoint reference the /developers page renders (lib/developers/endpoints).
 */

type Json = Record<string, unknown>;

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const nullable = (schema: Json) => ({ anyOf: [schema, { type: "null" }] });
const minor = (description: string) => ({
  type: "string",
  pattern: "^\\d+$",
  description: `${description} Integer minor units encoded as a string (USD and KES: cents; UGX and TZS: whole shillings).`,
  examples: ["115000"],
});
const timestamp = { type: "string", format: "date-time" };

const schemas: Record<string, Json> = {
  Pagination: {
    type: "object",
    required: ["page", "limit", "total", "has_more"],
    properties: {
      page: { type: "integer", minimum: 1 },
      limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT },
      total: { type: "integer", minimum: 0 },
      has_more: { type: "boolean" },
    },
  },
  Error: {
    type: "object",
    required: ["code", "message"],
    properties: {
      code: { type: "string", enum: Object.keys(ERROR_CODES) },
      message: { type: "string" },
      details: {
        type: "array",
        description: "Present on validation errors: one entry per invalid field.",
        items: {
          type: "object",
          required: ["path", "message"],
          properties: { path: { type: "string", examples: ["line_items.0.quantity"] }, message: { type: "string" } },
        },
      },
    },
  },
  ErrorResponse: {
    type: "object",
    required: ["data", "error"],
    properties: { data: { type: "null" }, error: ref("Error") },
  },
  Buyer: {
    type: "object",
    required: ["id", "object", "name", "kind", "email", "phone", "country", "created_at"],
    properties: {
      id: { type: "string", examples: ["buy_01k6c3v9r2a4c6e8g0j2l4n6p8"] },
      object: { const: "buyer" },
      name: { type: "string" },
      kind: { type: "string", enum: ["person", "company"] },
      email: nullable({ type: "string", format: "email" }),
      phone: nullable({ type: "string" }),
      country: { type: "string", minLength: 2, maxLength: 2 },
      created_at: timestamp,
    },
  },
  LineItem: {
    type: "object",
    required: ["description", "quantity", "unit_price_minor", "currency"],
    properties: {
      description: { type: "string" },
      quantity: { type: "string", description: "Decimal quantity as a string, for example \"500\" or \"2.5\"." },
      unit_price_minor: minor("Price per unit."),
      currency: { type: "string", enum: [...CURRENCY_VALUES] },
    },
  },
  Payment: {
    type: "object",
    required: [
      "id",
      "object",
      "invoice_id",
      "kind",
      "direction",
      "channel",
      "status",
      "currency",
      "amount_minor",
      "fee_minor",
      "net_minor",
      "merchant_reference",
      "payaza_reference",
      "occurred_at",
      "created_at",
    ],
    properties: {
      id: { type: "string", examples: ["txn_01k6c4a1b2c3d4e5f6g7h8j9k0"] },
      object: { const: "payment" },
      invoice_id: nullable({ type: "string" }),
      kind: { type: "string", enum: [...PAYMENT_KIND_VALUES] },
      direction: { type: "string", enum: ["in", "out"] },
      channel: {
        type: "string",
        enum: [
          "card",
          "apple_pay",
          "google_pay",
          "payment_link",
          "momo_ke",
          "momo_ug",
          "momo_tz",
          "mpesa_payout",
          "kepss_payout",
          "virtual_account",
          "manual",
        ],
      },
      status: { type: "string", enum: [...PAYMENT_STATUS_VALUES] },
      currency: { type: "string" },
      amount_minor: minor("Gross amount."),
      fee_minor: nullable(minor("Rail fee, when known.")),
      net_minor: nullable(minor("Amount after the rail fee, when known.")),
      merchant_reference: { type: "string", description: "Kusanya's reference, carried to Payaza as transaction_reference." },
      payaza_reference: nullable({ type: "string" }),
      occurred_at: nullable(timestamp),
      created_at: timestamp,
    },
  },
  RiskSummary: {
    type: "object",
    required: ["decision", "score"],
    properties: {
      decision: { type: "string", enum: ["pass", "review", "hold"] },
      score: { type: "integer", minimum: 0, maximum: 100 },
    },
  },
  Invoice: {
    type: "object",
    required: [
      "id",
      "object",
      "number",
      "status",
      "currency",
      "amount_minor",
      "amount_paid_minor",
      "fee_bearer",
      "buyer",
      "due_at",
      "issued_at",
      "notes",
      "pay_url",
      "payment_link_url",
      "risk",
      "created_at",
      "updated_at",
    ],
    properties: {
      id: { type: "string", examples: ["inv_01k6c3v9r8x2m4n6p8q0s2t4v6"] },
      object: { const: "invoice" },
      number: { type: "string", examples: ["KSN-2026-0007"] },
      status: { type: "string", enum: [...INVOICE_STATUS_VALUES] },
      currency: { type: "string", enum: [...CURRENCY_VALUES] },
      amount_minor: minor("Invoice total."),
      amount_paid_minor: minor("Sum of completed collections."),
      fee_bearer: { type: "string", enum: ["business", "customer"] },
      buyer: nullable({
        type: "object",
        required: ["id", "name", "country"],
        properties: { id: { type: "string" }, name: { type: "string" }, country: { type: "string" } },
      }),
      due_at: nullable(timestamp),
      issued_at: nullable(timestamp),
      notes: nullable({ type: "string" }),
      pay_url: { type: "string", format: "uri", description: "Kusanya hosted pay page for the buyer (card and mobile money)." },
      payment_link_url: nullable({ type: "string", format: "uri", description: "Payaza payment link, set once the invoice is finalized." }),
      risk: nullable(ref("RiskSummary")),
      created_at: timestamp,
      updated_at: timestamp,
    },
  },
  InvoiceDetail: {
    allOf: [
      ref("Invoice"),
      {
        type: "object",
        required: ["line_items", "payments"],
        properties: {
          line_items: { type: "array", items: ref("LineItem") },
          payments: { type: "array", items: ref("Payment") },
        },
      },
    ],
  },
  ExtractedField: {
    type: "object",
    required: ["value", "confidence", "snippet"],
    properties: {
      value: {},
      confidence: { type: "number", minimum: 0, maximum: 1 },
      snippet: nullable({ type: "string", description: "Source text supporting the value." }),
    },
  },
  Extraction: {
    type: "object",
    required: [
      "extraction_id",
      "object",
      "model",
      "quality",
      "duration_ms",
      "buyer",
      "currency",
      "total",
      "due_date",
      "firm_order",
      "line_items",
    ],
    properties: {
      extraction_id: { type: "string", examples: ["ext_01k6c5d7f9h1k3m5p7r9t1w3y5"] },
      object: { const: "extraction" },
      model: { type: "string", examples: ["jev-1.13.0", "demo-rules-v1"] },
      quality: { type: "number", minimum: 0, maximum: 1 },
      duration_ms: { type: "integer" },
      buyer: {
        allOf: [
          ref("ExtractedField"),
          { type: "object", properties: { matched_buyer_id: nullable({ type: "string" }) } },
        ],
      },
      currency: ref("ExtractedField"),
      total: {
        allOf: [ref("ExtractedField"), { type: "object", properties: { value: nullable(minor("Order total.")) } }],
      },
      due_date: ref("ExtractedField"),
      firm_order: ref("ExtractedField"),
      line_items: {
        type: "array",
        items: {
          type: "object",
          required: ["description", "quantity", "unit_price_minor", "currency", "confidence"],
          properties: {
            description: { type: "string" },
            quantity: { type: "number" },
            unit_price_minor: nullable(minor("Price per unit.")),
            currency: nullable({ type: "string" }),
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
        },
      },
    },
  },
  MinorAmountInput: {
    description: "Integer minor units. A string such as \"115000\" is preferred; a JSON integer is also accepted.",
    anyOf: [
      { type: "string", pattern: "^\\d{1,12}$" },
      { type: "integer", minimum: 0, maximum: 999999999999 },
    ],
  },
  CreateInvoiceRequest: {
    type: "object",
    required: ["buyer", "currency", "line_items"],
    properties: {
      buyer: {
        description: "An existing buyer by id, or a new buyer by name. When id is present the other fields are ignored.",
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string", minLength: 2, maxLength: 160 },
          email: nullable({ type: "string", format: "email" }),
          phone: nullable({ type: "string", pattern: "^\\+?\\d{7,15}$" }),
          country: { type: "string", pattern: "^[A-Za-z]{2}$", default: "KE" },
          kind: { type: "string", enum: ["person", "company"], default: "company" },
        },
      },
      currency: { type: "string", enum: [...CURRENCY_VALUES] },
      line_items: {
        type: "array",
        minItems: 1,
        maxItems: 50,
        items: {
          type: "object",
          required: ["description", "quantity", "unit_price_minor"],
          properties: {
            description: { type: "string", minLength: 1, maxLength: 500 },
            quantity: { type: "number", exclusiveMinimum: 0, maximum: 1000000, description: "At most two decimal places." },
            unit_price_minor: ref("MinorAmountInput"),
          },
        },
      },
      due_date: nullable({
        anyOf: [
          { type: "string", format: "date" },
          { type: "string", format: "date-time" },
        ],
      }),
      notes: nullable({ type: "string", maxLength: 2000 }),
      fee_bearer: { type: "string", enum: ["business", "customer"], default: "business" },
      extraction_id: nullable({ type: "string" }),
      send: { type: "boolean", default: false },
    },
  },
  ExtractRequest: {
    type: "object",
    required: ["text"],
    properties: { text: { type: "string", minLength: 3, maxLength: 20000 } },
  },
  OpenApiDocument: { type: "object", description: "This document." },
};

/** list-invoices `status` takes a comma separated list, so it has no enum. */
const isCommaList = (e: EndpointDoc, p: ParamDoc) => e.id === "list-invoices" && p.name === "status";

function paramSchema(p: ParamDoc, commaList = false): Json {
  const schema: Json = { type: p.type };
  if (p.enum && !commaList) schema.enum = [...p.enum];
  if (p.default !== undefined) schema.default = p.default;
  if (p.name === "limit") Object.assign(schema, { minimum: 1, maximum: MAX_LIMIT });
  if (p.name === "page") schema.minimum = 1;
  return schema;
}

function parameters(e: EndpointDoc): Json[] {
  const path = (e.pathParams ?? []).map((p) => ({
    name: p.name,
    in: "path",
    required: true,
    description: p.description,
    schema: paramSchema(p),
  }));
  const query = (e.queryParams ?? []).map((p) => ({
    name: p.name,
    in: "query",
    required: Boolean(p.required),
    description: isCommaList(e, p) && p.enum ? `${p.description} Values: ${p.enum.join(", ")}.` : p.description,
    schema: paramSchema(p, isCommaList(e, p)),
  }));
  return [...path, ...query];
}

function successSchema(e: EndpointDoc): Json {
  if (e.id === "openapi") return ref("OpenApiDocument");
  const data = e.responseList ? { type: "array", items: ref(e.responseSchema) } : ref(e.responseSchema);
  const properties: Json = { data, error: { type: "null" } };
  const required = ["data", "error"];
  if (e.responseList) {
    properties.pagination = ref("Pagination");
    required.push("pagination");
  }
  return { type: "object", required, properties };
}

function errorResponses(e: EndpointDoc): Json {
  const byStatus = new Map<number, string[]>();
  for (const code of [...e.errors, ...(e.auth ? (["internal_error"] as const) : [])]) {
    const status = ERROR_CODES[code];
    byStatus.set(status, [...(byStatus.get(status) ?? []), code]);
  }
  const out: Json = {};
  for (const [status, codes] of [...byStatus.entries()].sort((a, b) => a[0] - b[0])) {
    const meanings = codes.map((c) => `${c}: ${ERROR_DOCS.find((d) => d.code === c)?.meaning ?? ""}`);
    const headers =
      status === 429
        ? { "Retry-After": { description: "Seconds until the rate limit window resets.", schema: { type: "integer" } } }
        : undefined;
    out[String(status)] = {
      description: meanings.join(" "),
      ...(headers ? { headers } : {}),
      content: { "application/json": { schema: ref("ErrorResponse") } },
    };
  }
  return out;
}

function operation(e: EndpointDoc): Json {
  const op: Json = {
    operationId: e.operationId,
    tags: [e.tag],
    summary: e.title,
    description: [e.summary, ...e.description].join("\n\n"),
    parameters: parameters(e),
    responses: {
      [String(e.responseStatus)]: {
        description: e.summary,
        content: { "application/json": { schema: successSchema(e), example: e.responseExample } },
      },
      ...errorResponses(e),
    },
  };
  if (!e.auth) op.security = [];
  if (e.requestSchema) {
    op.requestBody = {
      required: true,
      content: { "application/json": { schema: ref(e.requestSchema), example: e.requestExample } },
    };
  }
  return op;
}

/** Endpoint path in OpenAPI form ("/invoices/{id}") → route dir ("invoices/[id]"). */
export function routeDirForPath(path: string): string {
  return path.replace(/^\//, "").replace(/\{(\w+)\}/g, "[$1]");
}

export function buildOpenApiDocument(appUrl: string): Json {
  const paths: Json = {};
  for (const e of ENDPOINTS) {
    const existing = (paths[e.path] as Json | undefined) ?? {};
    paths[e.path] = { ...existing, [e.method.toLowerCase()]: operation(e) };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Kusanya API",
      version: "1.0.0",
      summary: "Invoicing and international collections for Kenyan exporters, on Payaza rails.",
      description: [
        "Create invoices with Payaza payment links, extract invoice fields from chat orders, and read your payments ledger.",
        "All keys are test keys (ksn_test_...) and every rail runs on the Payaza sandbox.",
        "Money is always integer minor units encoded as strings in fields ending in _minor, next to a currency code.",
        `Rate limits: ${RATE_LIMITS_DOC}`,
      ].join("\n\n"),
    },
    servers: [{ url: `${appUrl.replace(/\/+$/, "")}/api/v1`, description: "This deployment (Payaza sandbox)" }],
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "Invoices", description: "Create, read and send invoices." },
      { name: "Extraction", description: "AI extraction of invoice fields from chat text." },
      { name: "Payments", description: "The transactions ledger." },
      { name: "Buyers", description: "Your buyer directory." },
      { name: "Meta", description: "API description." },
    ],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "API key from Dashboard > Developers, sent as Authorization: Bearer ksn_test_...",
        },
      },
      schemas,
    },
  };
}

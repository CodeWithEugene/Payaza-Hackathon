import { beforeAll, describe, expect, it } from "vitest";
import { db, ensureSchema } from "@/lib/db/client";
import { businesses, buyers, users } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { createApiKey, revokeApiKey } from "@/lib/services/api-keys";
import { GET as listBuyers } from "@/app/api/v1/buyers/route";
import { GET as listInvoices, POST as createInvoice } from "@/app/api/v1/invoices/route";
import { GET as getInvoice } from "@/app/api/v1/invoices/[id]/route";
import { POST as sendInvoice } from "@/app/api/v1/invoices/[id]/send/route";
import { GET as listPayments } from "@/app/api/v1/payments/route";
import { GET as openapi } from "@/app/api/v1/openapi.json/route";

/**
 * Route-level tests against in-memory PGlite in Demo Mode (vitest env): real
 * handlers, real services, recorded Payaza fixtures. Two businesses prove
 * that a key can never reach another business's rows.
 */

const BASE = "http://localhost/api/v1";
const noParams = { params: Promise.resolve({}) } as { params: Promise<Record<string, never>> };
const idParams = (id: string) => ({ params: Promise.resolve({ id }) });

let keyA = "";
let keyB = "";
let revokedKey = "";
let buyerA = "";

function req(path: string, init: { key?: string | null; method?: string; body?: unknown; rawBody?: string } = {}) {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.7" });
  if (init.key) headers.set("authorization", `Bearer ${init.key}`);
  if (init.body !== undefined || init.rawBody !== undefined) headers.set("content-type", "application/json");
  return new Request(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.rawBody ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
  });
}

async function seedBusiness(label: string) {
  const userId = `usr_${label}_${Date.now()}`;
  await db.insert(users).values({ id: userId, email: `${label}-${Date.now()}@example.test`, name: label });
  const businessId = newId("biz");
  await db.insert(businesses).values({ id: businessId, userId, name: `${label} Exports`, slug: `${label}-${businessId}` });
  return { userId, businessId };
}

beforeAll(async () => {
  await ensureSchema();
  const a = await seedBusiness("alpha");
  const b = await seedBusiness("beta");
  buyerA = newId("buy");
  await db.insert(buyers).values({ id: buyerA, businessId: a.businessId, name: "Dubai Fresh FZE", country: "AE" });
  await db.insert(buyers).values({ id: newId("buy"), businessId: b.businessId, name: "Beta Only Buyer", country: "KE" });

  keyA = (await createApiKey({ businessId: a.businessId, actorId: a.userId, name: "Alpha ERP" })).secret;
  keyB = (await createApiKey({ businessId: b.businessId, actorId: b.userId, name: "Beta ERP" })).secret;
  const toRevoke = await createApiKey({ businessId: a.businessId, actorId: a.userId, name: "Old key" });
  await revokeApiKey({ businessId: a.businessId, actorId: a.userId, keyId: toRevoke.key.id });
  revokedKey = toRevoke.secret;
}, 60_000);

describe("authentication", () => {
  it("rejects a request with no key", async () => {
    const res = await listBuyers(req("/buyers"), noParams);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthorized");
  });

  it("rejects an unknown key", async () => {
    const res = await listBuyers(req("/buyers", { key: `ksn_test_${"x".repeat(40)}` }), noParams);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthorized");
  });

  it("rejects a revoked key with key_revoked", async () => {
    const res = await listBuyers(req("/buyers", { key: revokedKey }), noParams);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("key_revoked");
  });
});

describe("business scoping", () => {
  it("lists only the key owner's buyers", async () => {
    const res = await listBuyers(req("/buyers", { key: keyA }), noParams);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBeNull();
    expect(body.data.map((b: { name: string }) => b.name)).toEqual(["Dubai Fresh FZE"]);
    expect(body.pagination).toEqual({ page: 1, limit: 25, total: 1, has_more: false });
  });
});

describe("invoices", () => {
  let invoiceId = "";

  it("returns 400 with field details for an invalid body", async () => {
    const res = await createInvoice(
      req("/invoices", { key: keyA, method: "POST", body: { buyer: {}, currency: "EUR", line_items: [] } }),
      noParams,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("validation_error");
    const paths = body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(["buyer.name", "currency", "line_items"]));
  });

  it("returns 400 invalid_json for a malformed body", async () => {
    const res = await createInvoice(req("/invoices", { key: keyA, method: "POST", rawBody: "{nope" }), noParams);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_json");
  });

  it("creates, screens and finalizes an invoice for an existing buyer", async () => {
    const res = await createInvoice(
      req("/invoices", {
        key: keyA,
        method: "POST",
        body: {
          buyer: { id: buyerA },
          currency: "USD",
          line_items: [{ description: "French beans (kg)", quantity: 500, unit_price_minor: "230" }],
          due_date: "2026-10-15",
        },
      }),
      noParams,
    );
    expect(res.status).toBe(201);
    const { data } = await res.json();
    invoiceId = data.id;
    expect(data.amount_minor).toBe("115000");
    expect(data.buyer.id).toBe(buyerA);
    expect(data.pay_url).toMatch(/\/i\/tok_/);
    expect(data.line_items).toEqual([
      { description: "French beans (kg)", quantity: "500", unit_price_minor: "230", currency: "USD" },
    ]);
    expect(["ready", "review", "on_hold"]).toContain(data.status);
    expect(data.risk).not.toBeNull();
  });

  it("returns 404 when another business's key asks for the invoice", async () => {
    const res = await getInvoice(req(`/invoices/${invoiceId}`, { key: keyB }), idParams(invoiceId));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("not_found");
  });

  it("sends a ready invoice, or refuses with 409 when it is held", async () => {
    const detail = await (await getInvoice(req(`/invoices/${invoiceId}`, { key: keyA }), idParams(invoiceId))).json();
    const res = await sendInvoice(req(`/invoices/${invoiceId}/send`, { key: keyA, method: "POST" }), idParams(invoiceId));
    if (detail.data.status === "ready") {
      expect(res.status).toBe(200);
      expect((await res.json()).data.status).toBe("sent");
    } else {
      expect(res.status).toBe(409);
      expect((await res.json()).error.code).toBe("invalid_state");
    }
  });

  it("filters the list by status and validates the filter", async () => {
    const ok = await listInvoices(req("/invoices?status=sent,ready,review,on_hold&limit=5", { key: keyA }), noParams);
    expect(ok.status).toBe(200);
    expect((await ok.json()).data.map((i: { id: string }) => i.id)).toContain(invoiceId);
    const bad = await listInvoices(req("/invoices?status=bogus", { key: keyA }), noParams);
    expect(bad.status).toBe(400);
    const other = await listInvoices(req("/invoices", { key: keyB }), noParams);
    expect((await other.json()).data).toEqual([]);
  });

  it("lists payments scoped to the business", async () => {
    const res = await listPayments(req(`/payments?invoice_id=${invoiceId}`, { key: keyB }), noParams);
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([]);
  });
});

describe("openapi.json", () => {
  it("is public", async () => {
    const res = await openapi();
    expect(res.status).toBe(200);
    expect((await res.json()).openapi).toBe("3.1.0");
  });
});

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiError, fail, mapServiceError, ok, toErrorResponse, zodDetails } from "@/lib/api/v1/envelope";
import {
  createInvoiceBodySchema,
  dueDateToIso,
  invoiceTotalMinor,
  lineTotalMinor,
  listInvoicesQuerySchema,
} from "@/lib/api/v1/schemas";
import { minorString } from "@/lib/api/v1/serializers";

describe("envelope helpers", () => {
  it("ok() wraps data with a null error and optional pagination", async () => {
    const res = ok([{ id: 1 }], { pagination: { page: 1, limit: 25, total: 1, has_more: false } });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      data: [{ id: 1 }],
      error: null,
      pagination: { page: 1, limit: 25, total: 1, has_more: false },
    });
  });

  it("ok() honours a custom status", () => {
    expect(ok({}, { status: 201 }).status).toBe(201);
  });

  it("fail() returns null data, a code and the mapped status", async () => {
    const res = fail("not_found", "No invoice.");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ data: null, error: { code: "not_found", message: "No invoice." } });
  });

  it("zodDetails flattens issue paths", () => {
    const parsed = z.object({ a: z.array(z.object({ b: z.number() })) }).safeParse({ a: [{ b: "x" }] });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(zodDetails(parsed.error)[0]?.path).toBe("a.0.b");
  });
});

describe("mapServiceError", () => {
  it("maps service not-found errors to 404", () => {
    expect(mapServiceError(new Error("invoice not found"))?.status).toBe(404);
    expect(mapServiceError(new Error("buyer not found in this business scope"))?.code).toBe("not_found");
  });

  it("maps send-state errors to 409 invalid_state", () => {
    const e = mapServiceError(new Error("invoice not sendable in status review"));
    expect(e?.status).toBe(409);
    expect(e?.message).toContain("review");
  });

  it("maps Payaza failures to 502 without leaking provider detail", () => {
    const e = mapServiceError(new Error("Payaza /payment-link → HTTP 500: secret upstream detail"));
    expect(e?.status).toBe(502);
    expect(e?.message).not.toContain("secret");
  });

  it("returns a generic 500 for unknown errors, never the raw message", async () => {
    const res = toErrorResponse(new Error("relation api_keys does not exist at /srv/app.ts:12"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("internal_error");
    expect(JSON.stringify(body)).not.toContain("api_keys");
  });

  it("passes ApiError through unchanged", () => {
    const err = new ApiError("validation_error", "bad", [{ path: "x", message: "y" }]);
    expect(mapServiceError(err)).toBe(err);
  });
});

describe("v1 request schemas", () => {
  const valid = {
    buyer: { name: "Dubai Fresh FZE", country: "ae" },
    currency: "USD",
    line_items: [{ description: "French beans (kg)", quantity: 500, unit_price_minor: "230" }],
    due_date: "2026-10-15",
  };

  it("accepts a minimal create body and applies defaults", () => {
    const parsed = createInvoiceBodySchema.parse(valid);
    expect(parsed.send).toBe(false);
    expect(parsed.fee_bearer).toBe("business");
    expect(parsed.buyer.country).toBe("AE");
    expect(parsed.line_items[0]?.unit_price_minor).toBe(230);
  });

  it("accepts integer unit prices and rejects decimals", () => {
    expect(createInvoiceBodySchema.safeParse({ ...valid, line_items: [{ description: "x", quantity: 1, unit_price_minor: 999 }] }).success).toBe(true);
    expect(createInvoiceBodySchema.safeParse({ ...valid, line_items: [{ description: "x", quantity: 1, unit_price_minor: "11.50" }] }).success).toBe(false);
    expect(createInvoiceBodySchema.safeParse({ ...valid, line_items: [{ description: "x", quantity: 1, unit_price_minor: 11.5 }] }).success).toBe(false);
  });

  it("requires a buyer id or a buyer name", () => {
    const parsed = createInvoiceBodySchema.safeParse({ ...valid, buyer: {} });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(zodDetails(parsed.error).some((d) => d.path === "buyer.name")).toBe(true);
  });

  it("rejects quantities with more than two decimals", () => {
    expect(createInvoiceBodySchema.safeParse({ ...valid, line_items: [{ description: "x", quantity: 1.005, unit_price_minor: "1" }] }).success).toBe(false);
    expect(createInvoiceBodySchema.safeParse({ ...valid, line_items: [{ description: "x", quantity: 2.5, unit_price_minor: "1" }] }).success).toBe(true);
  });

  it("computes totals in integer minor units", () => {
    expect(lineTotalMinor(500, 230)).toBe(115000);
    expect(lineTotalMinor(2.5, 333)).toBe(833); // 832.5 rounds half up
    expect(invoiceTotalMinor([
      { description: "a", quantity: 1, unit_price_minor: 100 },
      { description: "b", quantity: 3, unit_price_minor: 50 },
    ])).toBe(250);
  });

  it("normalises due dates", () => {
    expect(dueDateToIso("2026-10-15")).toBe("2026-10-15T00:00:00.000Z");
    expect(dueDateToIso("2026-10-15T12:00:00+03:00")).toBe("2026-10-15T09:00:00.000Z");
    expect(dueDateToIso(null)).toBeNull();
  });

  it("parses comma separated status filters and caps limit at 100", () => {
    expect(listInvoicesQuerySchema.parse({ status: "sent,paid" }).status).toEqual(["sent", "paid"]);
    expect(listInvoicesQuerySchema.parse({}).limit).toBe(25);
    expect(listInvoicesQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
    expect(listInvoicesQuerySchema.safeParse({ status: "bogus" }).success).toBe(false);
  });

  it("serializes DB numeric strings to integer strings", () => {
    expect(minorString("115000.00")).toBe("115000");
    expect(minorString(null)).toBe("0");
  });
});

import { describe, expect, it } from "vitest";
import { buildPaymentLinkRequest } from "@/lib/payaza/payment-link";
import { createPaymentLinkRequestSchema } from "@/lib/payaza/types";

const invoice = {
  number: "KSN-2026-0003",
  token: "tok_01m3meg03h286en8hjrez9ka5x",
  currency: "USD" as const,
  amountMinor: 115_000,
  feeBearer: "business",
};

describe("buildPaymentLinkRequest", () => {
  it("pairs the country code with the currency (USD needs USA)", () => {
    expect(buildPaymentLinkRequest(invoice, "FreshLeaf", "https://kusanya.app").country_code).toBe("USA");
    const kes = buildPaymentLinkRequest({ ...invoice, currency: "KES" }, "FreshLeaf", "https://kusanya.app");
    expect(kes.country_code).toBe("KEN");
  });

  it("sends major units using the currency's own minor factor", () => {
    expect(buildPaymentLinkRequest(invoice, "FreshLeaf", "https://kusanya.app").payment_amount).toBe(1150);
    const ugx = buildPaymentLinkRequest(
      { ...invoice, currency: "UGX", amountMinor: 4_250_000 },
      "FreshLeaf",
      "https://kusanya.app",
    );
    expect(ugx.payment_amount).toBe(4_250_000);
  });

  it("makes the link name unique per token so repeated invoice numbers never collide", () => {
    const a = buildPaymentLinkRequest(invoice, "FreshLeaf", "https://kusanya.app");
    const b = buildPaymentLinkRequest({ ...invoice, token: "tok_01zzzzzzzzzzzzzzzzzzzzzzzz" }, "FreshLeaf", "https://kusanya.app");
    expect(a.payment_link_name).not.toBe(b.payment_link_name);
    expect(a.payment_link_name.startsWith("Invoice KSN-2026-0003 ")).toBe(true);
  });

  it("omits a non-https redirect (Payaza's edge 403s localhost) and keeps https ones", () => {
    expect(buildPaymentLinkRequest(invoice, "FreshLeaf", "http://localhost:3100").redirect_url).toBeUndefined();
    expect(buildPaymentLinkRequest(invoice, "FreshLeaf", "https://kusanya.app").redirect_url).toBe(
      "https://kusanya.app/pay-done?ref=tok_01m3meg03h286en8hjrez9ka5x",
    );
  });

  it("produces a request that satisfies the wire schema", () => {
    const req = buildPaymentLinkRequest(invoice, "FreshLeaf", "https://kusanya.app");
    expect(createPaymentLinkRequestSchema.safeParse(req).success).toBe(true);
  });
});

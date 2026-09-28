import { describe, expect, it } from "vitest";
import { collectionWebhookSchema, parsePayazaTimestamp } from "@/lib/payaza/types";

/**
 * Shape of a REAL signed Payaza sandbox momo webhook (KENYA_COLLECTIONS,
 * 2026-09-28), with personal fields replaced. Note: no transaction_fee and no
 * merchant_reference; transaction_reference echoes our KSN reference.
 */
const realMomoWebhook = {
  transaction_reference: "KSN-SMOKE-MULI3D9Z",
  transaction_status: "Funds Received",
  amount_received: 10,
  initiated_date: "2026-09-28 18:07:39",
  current_status_date: "2026-09-28 18:07:41",
  received_from: { account_name: "Sandbox Smoke", account_number: "254712345678", bank_name: "M-PESA" },
  status: "Completed",
  status_reason: "Payment Approved",
  session_id: "1790615261000",
  channel: "KENYA_COLLECTIONS",
  branch: false,
  currency_code: "KES",
  payaza_account_reference: "1010000000",
  narration: "Kusanya sandbox smoke",
  business_fk: 1,
  customer: { email_address: "smoke@kusanya.demo", first_name: "Sandbox", last_name: "Smoke", mobile_number: "254712345678" },
  request_amount: 10,
  amount_validation: "EXACT",
};

describe("real Payaza momo webhook shape", () => {
  it("parses without transaction_fee or merchant_reference", () => {
    const parsed = collectionWebhookSchema.safeParse(realMomoWebhook);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.transaction_fee).toBeUndefined();
  });
});

describe("parsePayazaTimestamp", () => {
  it("reads zone-less Payaza timestamps as Lagos time (UTC+1)", () => {
    expect(parsePayazaTimestamp("2026-09-28 18:07:41")?.toISOString()).toBe("2026-09-28T17:07:41.000Z");
  });

  it("respects an explicit zone and rejects garbage", () => {
    expect(parsePayazaTimestamp("2026-09-28T18:07:41Z")?.toISOString()).toBe("2026-09-28T18:07:41.000Z");
    expect(parsePayazaTimestamp("not a date")).toBeNull();
    expect(parsePayazaTimestamp(null)).toBeNull();
  });
});

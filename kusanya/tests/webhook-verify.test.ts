import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyPayazaSignature, isDemoReplay, DEMO_REPLAY_HEADER } from "@/lib/payaza/webhook-verify";

const SECRET = "test-secret-key-for-hmac-512"; // matches vitest.config env

function sign(body: string): string {
  return createHmac("sha512", SECRET).update(body, "utf8").digest("base64");
}

describe("Payaza webhook signature (HMAC-SHA512, base64, raw bytes)", () => {
  const body = JSON.stringify({
    transaction_status: "Funds Received",
    transaction_reference: "PZ1234",
    merchant_reference: "KSN-ABC",
    amount_received: 1150,
    currency_code: "USD",
  });

  it("accepts a correctly signed raw body", () => {
    expect(verifyPayazaSignature(body, sign(body))).toBe(true);
  });

  it("accepts with surrounding whitespace on the header", () => {
    expect(verifyPayazaSignature(body, `  ${sign(body)}\n`)).toBe(true);
  });

  it("rejects a tampered body (signature over DIFFERENT bytes)", () => {
    const tampered = body.replace("1150", "9999");
    expect(verifyPayazaSignature(tampered, sign(body))).toBe(false);
  });

  it("rejects re-serialized JSON (whitespace changes break the hash)", () => {
    const reserialized = JSON.stringify(JSON.parse(body));
    // same semantics, different bytes — the reason we hash RAW text
    if (reserialized !== body) {
      expect(verifyPayazaSignature(reserialized, sign(body))).toBe(false);
    }
  });

  it("rejects missing/garbage signatures", () => {
    expect(verifyPayazaSignature(body, null)).toBe(false);
    expect(verifyPayazaSignature(body, "")).toBe(false);
    expect(verifyPayazaSignature(body, "not-base64-garbage")).toBe(false);
    expect(verifyPayazaSignature(body, sign(body).slice(0, -4))).toBe(false);
  });
});

describe("demo replay header gate", () => {
  it("bypass allowed ONLY in demo mode with the exact header", () => {
    const h = new Headers({ [DEMO_REPLAY_HEADER]: "true" });
    expect(isDemoReplay(h, true)).toBe(true);
    expect(isDemoReplay(h, false)).toBe(false); // live mode: never bypass
    expect(isDemoReplay(new Headers(), true)).toBe(false); // header required
    const wrong = new Headers({ [DEMO_REPLAY_HEADER]: "1" });
    expect(isDemoReplay(wrong, true)).toBe(false);
  });
});

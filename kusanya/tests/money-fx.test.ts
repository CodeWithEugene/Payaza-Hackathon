import { describe, it, expect } from "vitest";
import { indicativeQuote, settlementEta } from "@/lib/money/fx";

describe("indicativeQuote", () => {
  it("USD/KES quote shape + 30-minute validity window", () => {
    const now = new Date("2026-09-26T10:00:00Z");
    const q = indicativeQuote("USD", "KES", now);
    expect(q).not.toBeNull();
    expect(q!.pair).toBe("USD/KES");
    expect(q!.rate).toBe("128.900000");
    expect(q!.source).toBe("indicative");
    expect(q!.quotedAt).toBe(now.toISOString());
    expect(new Date(q!.expiresAt).getTime() - now.getTime()).toBe(30 * 60_000);
  });
  it("returns null for unquoted pairs (never fabricates a rate)", () => {
    expect(indicativeQuote("KES", "USD")).toBeNull();
    expect(indicativeQuote("TZS", "UGX")).toBeNull();
  });
});

describe("settlementEta (honest SLAs)", () => {
  it("USD collections: T+3–5 BUSINESS days", () => {
    // Friday 2026-09-25 UTC
    const fri = new Date("2026-09-25T00:00:00Z");
    const eta = settlementEta("USD", fri);
    expect(eta.label).toBe("T+3–5 business days");
    // +3 business days over the weekend → Wed 2026-09-30
    expect(eta.earliest.toISOString().slice(0, 10)).toBe("2026-09-30");
    // +5 → Fri 2026-10-02
    expect(eta.latest.toISOString().slice(0, 10)).toBe("2026-10-02");
    expect(eta.basis).toMatch(/Payaza/);
  });
  it("local currency (KES): T+1 next business day", () => {
    const fri = new Date("2026-09-25T00:00:00Z");
    const eta = settlementEta("KES", fri);
    expect(eta.label).toContain("T+1");
    // Friday + 1 business day → Monday 2026-09-28
    expect(eta.earliest.toISOString().slice(0, 10)).toBe("2026-09-28");
    expect(eta.latest.toISOString().slice(0, 10)).toBe("2026-09-28");
  });
  it("never promises same-day for USD", () => {
    const eta = settlementEta("USD", new Date("2026-09-26T00:00:00Z"));
    expect(eta.earliest.getTime()).toBeGreaterThan(Date.parse("2026-09-26T00:00:00Z"));
  });
});

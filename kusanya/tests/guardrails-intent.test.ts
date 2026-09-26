import { describe, it, expect } from "vitest";
import { ruleGuardrail, extractClaims, type LedgerFact } from "@/lib/jev/guardrails";
import { ruleIntent } from "@/lib/jev/intent";

const FACTS: LedgerFact[] = [
  { fact: "Invoice KSN-2026-0003 is for KES 48,500.00" },
  { fact: "Invoice KSN-2026-0003 is due on 2026-10-01" },
];

describe("extractClaims", () => {
  it("keeps only sentences containing numbers/dates (checkable claims)", () => {
    const claims = extractClaims(
      "Hi! Invoice KSN-2026-0003 for KES 48,500.00 is due on 2026-10-01. Please pay via M-Pesa. Asante!",
    );
    expect(claims.length).toBeGreaterThanOrEqual(1);
    expect(claims.join(" ")).toContain("48,500.00");
    expect(claims.join(" ")).not.toContain("Asante");
    expect(claims.length).toBeLessThanOrEqual(6);
  });
});

describe("ruleGuardrail (deterministic Demo/Jev-down guardrail)", () => {
  it("passes a draft whose claims are all cited by ledger facts", () => {
    const r = ruleGuardrail(
      "Invoice KSN-2026-0003 for KES 48,500.00 is due on 2026-10-01. Kindly pay via M-Pesa.",
      FACTS,
    );
    expect(r.blocked).toBe(false);
    expect(r.safe).toBe(true);
    expect(r.unsafeProbability).toBeLessThanOrEqual(0.3);
    expect(r.source).toBe("demo-rules");
    expect(r.claims.every((c) => c.supported)).toBe(true);
  });

  it("BLOCKS threats / legal-action language (P > 0.3)", () => {
    const r = ruleGuardrail("Pay now or we take legal action against you. Invoice 5.", FACTS);
    expect(r.blocked).toBe(true);
    expect(r.unsafeProbability).toBe(0.9);
  });

  it("blocks on every intimidation pattern", () => {
    for (const draft of [
      "We will report you to the police. Invoice 1.",
      "Final warning: pay invoice 2 today.",
      "Our lawyers will sue you over invoice 3.",
      "You will be blacklisted over invoice 4.",
    ]) {
      expect(ruleGuardrail(draft, FACTS).blocked).toBe(true);
    }
  });

  it("BLOCKS uncited amounts — claims must match the ledger", () => {
    const r = ruleGuardrail("Invoice KSN-2026-0003 for KES 99,999.00 is due.", FACTS);
    expect(r.blocked).toBe(true);
    expect(r.claims.some((c) => !c.supported)).toBe(true);
  });

  it("blocks fabricated due dates", () => {
    const r = ruleGuardrail("Invoice KSN-2026-0003 is due on 2026-12-25.", FACTS);
    expect(r.blocked).toBe(true);
  });
});

describe("ruleIntent (buyer-reply routing)", () => {
  it("promise to pay", () => {
    const r = ruleIntent("I'll pay by Monday, sorry for the delay");
    expect(r.intent).toBe("promise_to_pay");
    expect(r.confidence).toBeGreaterThanOrEqual(0.5);
    expect(r.reliable).toBe(true);
    expect(r.source).toBe("demo-rules");
  });

  it("dispute", () => {
    const r = ruleIntent("The tomatoes arrived damaged — I want a refund");
    expect(r.intent).toBe("dispute");
    expect(r.reliable).toBe(true);
  });

  it("question", () => {
    const r = ruleIntent("When will the shipment arrive?");
    expect(r.intent).toBe("question");
  });

  it("spam", () => {
    const r = ruleIntent("You have WON a lottery! Click here to claim");
    expect(r.intent).toBe("spam");
  });

  it("unknown → other with LOW confidence, reliable:false (no auto-action)", () => {
    const r = ruleIntent("ok thanks");
    expect(r.intent).toBe("other");
    expect(r.confidence).toBeLessThan(0.5);
    expect(r.reliable).toBe(false);
  });
});

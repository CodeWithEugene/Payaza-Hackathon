import { describe, it, expect } from "vitest";
import { assessRisk, nameDissimilarity, HIGH_RISK_JURISDICTIONS } from "@/lib/jev/risk-composite";
import { RISK_WEIGHTS, RISK_THRESHOLDS, decisionFromScore, band, GUARDRAIL_BLOCK_P } from "@/lib/jev/types";

describe("risk primitives", () => {
  it("weights sum to exactly 100 (score is a 0–100 composite)", () => {
    const sum = Object.values(RISK_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
    expect(RISK_WEIGHTS).toEqual({ sanctions: 40, anomaly: 20, first: 15, jurisdiction: 15, mismatch: 10 });
  });

  it("decision thresholds: pass < 40 ≤ review < 70 ≤ hold", () => {
    expect(RISK_THRESHOLDS).toEqual({ review: 40, hold: 70 });
    expect(decisionFromScore(0)).toBe("pass");
    expect(decisionFromScore(39)).toBe("pass");
    expect(decisionFromScore(40)).toBe("review");
    expect(decisionFromScore(69)).toBe("review");
    expect(decisionFromScore(70)).toBe("hold");
    expect(decisionFromScore(100)).toBe("hold");
  });

  it("confidence bands: HIGH ≥0.85, MED ≥0.60, LOW below", () => {
    expect(band(1)).toBe("high");
    expect(band(0.85)).toBe("high");
    expect(band(0.849)).toBe("medium");
    expect(band(0.6)).toBe("medium");
    expect(band(0.599)).toBe("low");
    expect(band(0)).toBe("low");
  });

  it("guardrail block threshold is 0.3", () => {
    expect(GUARDRAIL_BLOCK_P).toBe(0.3);
  });

  it("nameDissimilarity: token Jaccard distance", () => {
    expect(nameDissimilarity("Dubai Fresh FZE", "Dubai Fresh FZE")).toBe(0);
    expect(nameDissimilarity("Dubai Fresh FZE", "dubai fresh fze")).toBe(0);
    expect(nameDissimilarity("Dubai Fresh FZE", "Nairobi Beans Ltd")).toBe(1);
    const d = nameDissimilarity("Dubai Fresh FZE", "Dubai Fresh Trading");
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(1);
    expect(nameDissimilarity("", "x")).toBe(0.5); // degenerate → neutral
  });
});

describe("assessRisk (Demo Mode = deterministic rules; Jev disabled in tests)", () => {
  it("clean repeat buyer → pass with low score, demo-rules source", async () => {
    const r = await assessRisk({
      text: null,
      buyerName: "Dubai Fresh FZE",
      buyerCountry: "AE",
      isFirstBuyer: false,
      invoiceTotalMinor: 115000,
      historyAverageMinor: 110000, // ratio ≈ 1.05 → anomaly 0.05
    });
    // sanctions 0.02×40 + anomaly 0.05×20 + first 0 + jurisdiction 0.05×15 + mismatch 0
    expect(r.score).toBe(Math.round(0.8 + 1 + 0 + 0.75)); // 3
    expect(r.decision).toBe("pass");
    expect(r.source).toBe("demo-rules");
    expect(r.criteria).toHaveLength(5);
    expect(r.criteria.map((c) => c.key)).toEqual(["sanctions", "anomaly", "first", "jurisdiction", "mismatch"]);
  });

  it("SANCTIONS language → fail-closed HOLD even for a repeat buyer", async () => {
    const r = await assessRisk({
      text: "Please route the dual-use equipment via a third country to evade sanctions.",
      buyerName: "Kato Grocers",
      buyerCountry: "UG",
      isFirstBuyer: false,
      invoiceTotalMinor: 4100000,
      historyAverageMinor: 1000000,
    });
    expect(r.decision).toBe("hold");
    const sanctions = r.criteria.find((c) => c.key === "sanctions")!;
    expect(sanctions.probability).toBeGreaterThanOrEqual(0.9);
    // Fail-closed floor overrides the raw threshold: any P≥0.9 sanctions hit
    // holds regardless of composite score (score here = 38+19+0.75 ≈ 58).
    expect(r.score).toBeGreaterThanOrEqual(40);
  });

  it("sanctions word + otherwise clean → at least review (never silent pass)", async () => {
    const r = await assessRisk({
      text: "The goods are not military grade, ordinary produce only.",
      buyerName: "Amani Foods",
      buyerCountry: "TZ",
      isFirstBuyer: false,
      invoiceTotalMinor: 100000,
      historyAverageMinor: 100000,
    });
    expect(["review", "hold"]).toContain(r.decision);
  });

  it("first-time buyer + no history + null total → deterministic 0.35 anomaly, still passable in demo-rules", async () => {
    const r = await assessRisk({
      text: null,
      buyerName: "Some New Buyer",
      buyerCountry: "AE",
      isFirstBuyer: true,
      invoiceTotalMinor: null,
      historyAverageMinor: null,
    });
    // sanctions .8 + anomaly 7 + first 15 + jurisdiction .75 = 23.55 → 24
    expect(r.score).toBe(24);
    expect(r.decision).toBe("pass");
  });

  it("huge anomaly vs history: P=0.95 but score stays threshold-consistent", async () => {
    const r = await assessRisk({
      text: null,
      buyerName: "Dubai Fresh FZE",
      buyerCountry: "AE",
      isFirstBuyer: false,
      invoiceTotalMinor: 5000000, // 50× their average
      historyAverageMinor: 100000,
    });
    // anomaly 0.95×20 = 19 + sanctions 0.8 + jurisdiction 0.75 = 20.55 → 21? plus first 0
    const anomaly = r.criteria.find((c) => c.key === "anomaly")!;
    expect(anomaly.probability).toBe(0.95);
    expect(r.score).toBe(21);
    // score alone is pass; but the composite is designed so anomaly ALONE
    // can't hold — verify decision is consistent with thresholds:
    expect(r.decision).toBe("pass");
  });

  it("high-risk jurisdiction floors at review (compliance floor)", async () => {
    expect(HIGH_RISK_JURISDICTIONS.has("IR")).toBe(true);
    const r = await assessRisk({
      text: null,
      buyerName: "Tehran Trading",
      buyerCountry: "IR",
      isFirstBuyer: false,
      invoiceTotalMinor: 100000,
      historyAverageMinor: 100000,
    });
    expect(r.decision).not.toBe("pass");
    expect(["review", "hold"]).toContain(r.decision);
    const jur = r.criteria.find((c) => c.key === "jurisdiction")!;
    expect(jur.probability).toBe(0.8);
  });

  it("name mismatch contributes dissimilarity × 10", async () => {
    const r = await assessRisk({
      text: null,
      buyerName: "Dubai Fresh FZE",
      buyerCountry: "AE",
      isFirstBuyer: false,
      invoiceTotalMinor: 100000,
      historyAverageMinor: 100000,
      nameMismatch: { expected: "Dubai Fresh FZE", got: "Gulf Shell Holdings LLC" },
    });
    const m = r.criteria.find((c) => c.key === "mismatch")!;
    expect(m.probability).toBe(1);
    expect(r.score).toBeGreaterThanOrEqual(10);
  });
});

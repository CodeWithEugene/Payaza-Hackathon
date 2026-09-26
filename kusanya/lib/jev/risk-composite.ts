import "server-only";
import { noul } from "@typesafe-ai/sdk";
import { askSystemOne, JevUnavailable, jevEnabled } from "./client";
import {
  RISK_WEIGHTS,
  decisionFromScore,
  type RiskAssessmentResult,
  type RiskCriterion,
  type RiskDecision,
} from "./types";

/**
 * Composite risk screening (build.md §7, solution §9):
 *   score = Σ weight × P(yes), weights {sanctions:40, anomaly:20, first:15,
 *   jurisdiction:15, mismatch:10} → 0–100.
 *   decision: pass < 40 ≤ review < 70 ≤ hold.
 *
 * Facts (first-buyer, jurisdiction list, name mismatch) are DETERMINISTIC.
 * Judgments (sanctions language, amount anomaly) use batched Nouls when Jev
 * is live; otherwise rule-based probabilities labeled "demo-rules".
 * Jev failure mid-flight → fail-safe fallback: sanctions regex ALWAYS runs
 * (fail-closed), new buyers floor at `review` (never fail-open).
 */

/** Elevated-review jurisdictions (sanctioned / high-risk trade corridors). */
export const HIGH_RISK_JURISDICTIONS = new Set([
  "IR", "KP", "SY", "CU", "BY", "RU", "AF", "MM", "VE", "YE",
]);

const SANCTIONS_RE =
  /(sanction(?:s|ed)?|embargo(?:ed)?|evade|evasion|dual[\s-]use|military|arms|ammunition|nuclear|missile|blacklist|blocked party|ofac)/i;

export interface RiskInput {
  text?: string | null;
  buyerName: string;
  buyerCountry: string; // ISO-2
  isFirstBuyer: boolean;
  invoiceTotalMinor: number | null;
  historyAverageMinor?: number | null;
  /** Expected vs presented name (e.g. bank account name ≠ buyer name). */
  nameMismatch?: { expected: string; got: string } | null;
}

export async function assessRisk(input: RiskInput): Promise<RiskAssessmentResult> {
  // ---- deterministic facts ----
  const firstP = input.isFirstBuyer ? 1 : 0;
  const jurisdictionP = HIGH_RISK_JURISDICTIONS.has(input.buyerCountry.toUpperCase()) ? 0.8 : 0.05;
  const mismatchP = input.nameMismatch ? nameDissimilarity(input.nameMismatch.expected, input.nameMismatch.got) : 0;
  const anomalyP = deterministicAnomaly(input.invoiceTotalMinor, input.historyAverageMinor ?? null);
  const sanctionsRegexHit = input.text ? SANCTIONS_RE.test(input.text) : false;

  // ---- judgment: sanctions + anomaly ----
  let sanctionsP: number;
  let anomalyFinalP = anomalyP;
  let source: RiskAssessmentResult["source"] = "demo-rules";
  let jevAnswerId: string | undefined;

  if (jevEnabled() && input.text) {
    try {
      const result = await askSystemOne(
        {
          sanctions_lang: noul(
            "Does the text contain sanctions-evasion language or references to prohibited/controlled goods (arms, dual-use, embargoed destinations)?",
            {
              true: "Explicit or implied evasion of trade controls, or prohibited goods",
              false: "Ordinary commercial trade content",
            },
          ),
          amount_anomaly: noul(
            "Given this buyer's payment history in the state, is the invoice total anomalously high (more than ~30% above their historical average)?",
            {
              true: "Clearly exceeds the historical pattern",
              false: "Consistent with history, or no history exists",
            },
          ),
        },
        {
          text: input.text,
          buyer: { name: input.buyerName, country: input.buyerCountry, isFirst: input.isFirstBuyer },
          invoice_total_minor: input.invoiceTotalMinor,
          history_average_minor: input.historyAverageMinor ?? null,
        },
        { timeoutMs: 4_000 },
      );
      const a = result.answers as Record<string, { noul: number }>;
      // Fail-closed: regex hit OR model P — whichever is higher.
      sanctionsP = Math.max(a.sanctions_lang?.noul ?? 0, sanctionsRegexHit ? 0.95 : 0);
      anomalyFinalP = Math.max(a.amount_anomaly?.noul ?? 0, anomalyP * 0.8);
      source = "jev";
      jevAnswerId = `jev_${Date.now().toString(36)}`;
    } catch (err) {
      if (!(err instanceof JevUnavailable)) {
        console.warn("[jev] risk fell back to rules:", err);
      }
      sanctionsP = sanctionsRegexHit ? 0.95 : 0.02;
      source = "fallback";
    }
  } else {
    sanctionsP = sanctionsRegexHit ? 0.95 : 0.02;
    source = jevEnabled() ? "fallback" : "demo-rules"; // no text → facts only
  }

  // ---- composite ----
  const criteria: RiskCriterion[] = [
    {
      key: "sanctions",
      label: "Sanctions / prohibited-goods language",
      probability: round2(sanctionsP),
      weight: RISK_WEIGHTS.sanctions,
      criterion: "Text screened for trade-control evasion and prohibited goods",
    },
    {
      key: "anomaly",
      label: "Amount anomaly vs buyer history",
      probability: round2(anomalyFinalP),
      weight: RISK_WEIGHTS.anomaly,
      criterion: "Total more than ~30% above this buyer's historical average",
    },
    {
      key: "first",
      label: "First-time buyer",
      probability: firstP,
      weight: RISK_WEIGHTS.first,
      criterion: "No prior settled invoices with this buyer (deterministic fact)",
    },
    {
      key: "jurisdiction",
      label: "Jurisdiction risk",
      probability: jurisdictionP,
      weight: RISK_WEIGHTS.jurisdiction,
      criterion: `Buyer country ${input.buyerCountry.toUpperCase()} on elevated-review list`,
    },
    {
      key: "mismatch",
      label: "Name mismatch",
      probability: round2(mismatchP),
      weight: RISK_WEIGHTS.mismatch,
      criterion: "Presented name diverges from directory/expected name",
    },
  ];

  const score = Math.round(
    criteria.reduce((sum, c) => sum + c.weight * c.probability, 0),
  );
  let decision: RiskDecision = decisionFromScore(score);

  // Fail-safe floor: fallback source + first buyer → at least review.
  if (source === "fallback" && input.isFirstBuyer && decision === "pass") {
    decision = "review";
  }
  // Sanctions fail-closed: regex hit always at least review, ≥0.9 → hold.
  if (sanctionsRegexHit) {
    if (sanctionsP >= 0.9) decision = "hold";
    else if (decision === "pass") decision = "review";
  }

  return { score, decision, criteria, source, jevAnswerId };
}

/** Deterministic anomaly probability from ratio (used live AND in fallback). */
function deterministicAnomaly(
  totalMinor: number | null,
  historyAverageMinor: number | null,
): number {
  if (totalMinor == null || historyAverageMinor == null || historyAverageMinor <= 0) return 0.35;
  const ratio = totalMinor / historyAverageMinor;
  if (ratio > 3) return 0.95;
  if (ratio > 1.3) return 0.9;
  if (ratio > 0.7) return 0.05;
  return 0.2; // unusually LOW can also signal testing/fraud — mild bump
}

/** 0..1 dissimilarity between two names (token Jaccard). */
export function nameDissimilarity(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2));
  const tb = new Set(b.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0.5;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = new Set([...ta, ...tb]).size;
  return round2(1 - inter / union);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

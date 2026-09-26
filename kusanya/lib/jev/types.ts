import { z } from "zod";

/**
 * Shared AI-layer types + Zod validation of every model answer boundary
 * (typed end-to-end rule). Confidence bands drive UI treatment:
 *   HIGH ≥ 0.85 → prefilled, quiet
 *   MED  ≥ 0.60 → prefilled, subtle ring
 *   LOW  < 0.60 → amber highlight + source-snippet tooltip + "Looks right" tap
 */

export const HIGH_CONFIDENCE = 0.85;
export const MED_CONFIDENCE = 0.6;

export type ConfidenceBand = "high" | "medium" | "low";

export function band(confidence: number): ConfidenceBand {
  if (confidence >= HIGH_CONFIDENCE) return "high";
  if (confidence >= MED_CONFIDENCE) return "medium";
  return "low";
}

export interface ExtractedField<T> {
  value: T | null;
  confidence: number;
  /** Verbatim snippet from source text backing this field (citation-check). */
  snippet: string | null;
  /** True when resolved deterministically in code (never model-generated). */
  deterministic: boolean;
  /** True when produced by Demo Mode rule fallback (honesty labeling). */
  demo?: boolean;
}

export interface ExtractedItem {
  description: string;
  qty: number;
  unitPriceMinor: number | null;
  currency: string | null;
  confidence: number;
}

export interface InvoiceExtractionResult {
  buyer: ExtractedField<string>;
  buyerCandidateId: string | null; // matched directory id, null → "create new"
  items: ExtractedItem[];
  total: ExtractedField<number>; // minor units — resolved IN CODE from candidates
  currency: ExtractedField<string>; // USD|KES|UGX|TZS
  dueDate: ExtractedField<string>; // ISO date — resolved IN CODE
  firmOrder: ExtractedField<boolean>; // commits to purchase vs mere enquiry
  quality: number; // 0..1 score answer
  /** Raw Jev answers persisted to ai_extractions (audit trail). */
  rawAnswers: unknown;
  model: string; // "jev-latest" | "demo-rules-v1"
  durationMs: number;
}

export const extractionFieldSchema = z.object({
  value: z.unknown().nullable(),
  confidence: z.number().min(0).max(1),
  snippet: z.string().nullable(),
  deterministic: z.boolean(),
  demo: z.boolean().optional(),
});

// ---------------------------------------------------------------- risk types --

export interface RiskCriterion {
  key: string;
  label: string;
  probability: number; // P(yes) from Noul (or deterministic rule in demo)
  weight: number;
  criterion: string; // human-readable, shown in review hovercard
}

export type RiskDecision = "pass" | "review" | "hold";

export interface RiskAssessmentResult {
  score: number; // 0–100
  decision: RiskDecision;
  criteria: RiskCriterion[];
  /** "jev" | "demo-rules" | "fallback" (Jev down → fail-safe default). */
  source: "jev" | "demo-rules" | "fallback";
  jevAnswerId?: string;
}

/** Composite weights (solution §9 — tunable in code, never re-inferred). */
export const RISK_WEIGHTS = {
  sanctions: 40,
  anomaly: 20,
  first: 15,
  jurisdiction: 15,
  mismatch: 10,
} as const;

/** Thresholds: pass < 40 ≤ review < 70 ≤ hold (solution §9). */
export const RISK_THRESHOLDS = { review: 40, hold: 70 } as const;

export function decisionFromScore(score: number): RiskDecision {
  if (score >= RISK_THRESHOLDS.hold) return "hold";
  if (score >= RISK_THRESHOLDS.review) return "review";
  return "pass";
}

// -------------------------------------------------------------- intent types --

export type BuyerIntent =
  | "promise_to_pay"
  | "dispute"
  | "question"
  | "spam"
  | "other";

export const LOW_INTENT_CONFIDENCE = 0.5;

export interface IntentResult {
  intent: BuyerIntent;
  confidence: number;
  /** Below LOW_INTENT_CONFIDENCE → UI shows raw message, no auto-action. */
  reliable: boolean;
  source: "jev" | "demo-rules";
}

// ---------------------------------------------------------- guardrail types --

export interface GuardrailResult {
  safe: boolean;
  unsafeProbability: number;
  /** Per-claim citation check against ledger facts. */
  claims: { claim: string; supported: boolean; probability: number }[];
  blocked: boolean; // unsafeProbability > 0.3 → block, merchant must rewrite
  source: "jev" | "demo-rules";
}

export const GUARDRAIL_BLOCK_P = 0.3;

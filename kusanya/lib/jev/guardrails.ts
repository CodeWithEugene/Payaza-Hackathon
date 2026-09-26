import "server-only";
import { askSystemOne, JevUnavailable, jevEnabled } from "./client";
import { guardrailQuestions } from "./questions";
import { GUARDRAIL_BLOCK_P, type GuardrailResult } from "./types";

/**
 * Reminder guardrails (build.md §7): before ANY AI-drafted reminder leaves —
 *  1. Noul: unsafe/inaccurate claims? P > 0.3 → BLOCK (merchant rewrites)
 *  2. Per-claim citation Choice against ledger facts → unsupported claims flagged
 * AI drafts, human sends — nothing auto-sends to a buyer (solution §9).
 */

const UNSAFE_RE =
  /(legal action|lawyer|court|sue|authorities|police|arrest|final warning|immediately or else|blacklist|shame|embarrass)/i;

export interface LedgerFact {
  fact: string; // e.g. "Invoice KSN-2026-0042 is for USD 1,150.00"
}

export async function checkReminderDraft(
  draft: string,
  facts: LedgerFact[],
): Promise<GuardrailResult> {
  const claims = extractClaims(draft);

  if (jevEnabled()) {
    try {
      const result = await askSystemOne(
        guardrailQuestions(claims.map((c, i) => ({ key: String(i), claim: c }))),
        { draft, ledger_facts: facts.map((f) => f.fact) },
        { timeoutMs: 4_000 },
      );
      const a = result.answers as Record<string, { noul?: number; choice?: string; confidence?: number }>;
      const unsafeProbability = a.unsafe_claims?.noul ?? 0;
      const checked = claims.map((claim, i) => {
        const ans = a[`cite_${i}`];
        return {
          claim,
          supported: ans?.choice === "supported",
          probability: ans?.confidence ?? 0.5,
        };
      });
      const blocked = unsafeProbability > GUARDRAIL_BLOCK_P;
      return { safe: !blocked, unsafeProbability, claims: checked, blocked, source: "jev" };
    } catch (err) {
      if (!(err instanceof JevUnavailable)) console.warn("[jev] guardrail fell back:", err);
    }
  }
  return ruleGuardrail(draft, facts);
}

/** Deterministic rules for Demo Mode / Jev down. */
export function ruleGuardrail(draft: string, facts: LedgerFact[]): GuardrailResult {
  const unsafeHit = UNSAFE_RE.test(draft);
  const factsBlob = facts.map((f) => f.fact.toLowerCase()).join(" ");
  const claims = extractClaims(draft).map((claim) => {
    // citation check: every number/amount/date token in the claim must appear in facts
    const tokens = claim.match(/\d[\d,.]*|[A-Z]{3}\s?\d[\d,.]*|\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?/gi) ?? [];
    const supported = tokens.every((tok) =>
      factsBlob.includes(tok.toLowerCase().replace(/,/g, "")) || factsBlob.includes(tok.toLowerCase()),
    );
    return { claim, supported: tokens.length === 0 ? true : supported, probability: tokens.length === 0 ? 0.9 : supported ? 0.85 : 0.2 };
  });
  const unsafeProbability = unsafeHit ? 0.9 : 0.05;
  const blocked = unsafeProbability > GUARDRAIL_BLOCK_P || claims.some((c) => !c.supported);
  return { safe: !blocked, unsafeProbability, claims, blocked, source: "demo-rules" };
}

/** Extract checkable factual claims: sentences containing numbers/dates/amounts. */
export function extractClaims(draft: string): string[] {
  return draft
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8 && /\d/.test(s))
    .slice(0, 6);
}

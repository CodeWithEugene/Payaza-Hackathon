import "server-only";
import { askSystemOne, JevUnavailable, jevEnabled } from "./client";
import { intentQuestions } from "./questions";
import { LOW_INTENT_CONFIDENCE, type BuyerIntent, type IntentResult } from "./types";

/**
 * Buyer-reply intent routing (build.md §7): Choice over
 * {promise_to_pay, dispute, question, spam, other}; confidence < 0.5 → UI
 * shows the raw message, no automatic action (never mis-route money talk).
 */

export async function classifyBuyerMessage(
  message: string,
  context: { invoiceNumber: string; status: string; dueAt?: string | null },
): Promise<IntentResult> {
  if (jevEnabled()) {
    try {
      const result = await askSystemOne(intentQuestions(), {
        buyer_reply: message,
        invoice: context,
      }, { timeoutMs: 4_000 });
      const a = result.answers as Record<string, { choice: string; confidence: number }>;
      const intent = (a.intent?.choice ?? "other") as BuyerIntent;
      const confidence = a.intent?.confidence ?? 0.5;
      return {
        intent,
        confidence,
        reliable: confidence >= LOW_INTENT_CONFIDENCE,
        source: "jev",
      };
    } catch (err) {
      if (!(err instanceof JevUnavailable)) console.warn("[jev] intent fell back:", err);
    }
  }
  return ruleIntent(message);
}

/** Deterministic keyword rules for Demo Mode / Jev down. */
export function ruleIntent(message: string): IntentResult {
  const t = message.toLowerCase();
  let intent: BuyerIntent = "other";
  let confidence = 0.4;
  if (/(paid|payment sent|transferred|will pay|i'?ll pay|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|end of|eom)|mpesa sent|receipt)/.test(t)) {
    intent = "promise_to_pay";
    confidence = 0.85;
  } else if (/(wrong|damaged|defective|dispute|refund|not what i ordered|short(ed)?|credit note|overcharged|never received)/.test(t)) {
    intent = "dispute";
    confidence = 0.85;
  } else if (/(unsubscribe|promo|offer|lottery|winner|click here)/.test(t)) {
    intent = "spam";
    confidence = 0.8;
  } else if (/\?\b|(how (do|can|much)|when will|where is|what('| i)s|can you (send|share)|bank details|breakdown)/.test(t)) {
    intent = "question";
    confidence = 0.75;
  }
  return {
    intent,
    confidence,
    reliable: confidence >= LOW_INTENT_CONFIDENCE,
    source: "demo-rules",
  };
}

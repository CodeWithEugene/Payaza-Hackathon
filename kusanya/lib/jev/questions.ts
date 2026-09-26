import { choice, noul, score } from "@typesafe-ai/sdk";

/**
 * Typed question builders (build.md §7). One batched systemOne call per
 * invoice creation. Labels are opaque keys (amt_0, date_1, buyer_<id>) —
 * the model SELECTS among code-extracted candidates; every number and date
 * is resolved deterministically in code afterwards. The model never emits
 * amounts or dates (pre-parsed value extraction pattern, research §6.3).
 */

export function extractionQuestions(opts: {
  amountKeys: { key: string; description: string }[];
  dateKeys: { key: string; description: string }[];
  buyerKeys: { key: string; description: string }[];
}) {
  return {
    buyer_select: choice(
      "Which candidate is the buyer (the party being invoiced) named in the message?",
      {
        ...Object.fromEntries(
          opts.buyerKeys.map((b) => [b.key, b.description]),
        ),
        new: "None of the listed candidates — the buyer is someone new",
      },
    ),
    firm_order: noul(
      "Does this message commit to a purchase (a firm order), rather than merely enquiring about price or availability?",
      {
        true: "The sender asks for goods/services to be supplied, confirms an order, or instructs shipping",
        false: "The sender only asks questions ('how much?', 'do you have?') without committing",
      },
    ),
    amount_select: choice(
      "Which candidate number is the TOTAL invoice amount to be paid (not a unit price, not a quantity, not a weight)?",
      {
        ...Object.fromEntries(
          opts.amountKeys.map((a) => [a.key, a.description]),
        ),
        none: "No candidate is the total amount",
      },
    ),
    currency_pick: choice("Which currency will payment be made in?", {
      USD: "US dollars ($, USD, dollars)",
      KES: "Kenyan shillings (KES, KSh)",
      UGX: "Ugandan shillings (UGX, USh)",
      TZS: "Tanzanian shillings (TZS, TSh)",
      unknown: "The message does not make the currency clear",
    }),
    due_date_pick: choice(
      "Which candidate date is the PAYMENT due date for this invoice?",
      {
        ...Object.fromEntries(
          opts.dateKeys.map((d) => [d.key, d.description]),
        ),
        none: "No payment due date is mentioned",
      },
    ),
    due_is_payment: noul(
      "If a due date was selected, does it refer to when PAYMENT is due (not a delivery or shipping date)?",
      {
        true: "The date is tied to paying/settling the invoice",
        false: "The date is tied to delivery, shipping, or expiry of the quote",
      },
    ),
    sanctions_lang: noul(
      "Does the text contain sanctions-evasion language or references to prohibited/controlled goods (arms, dual-use, embargoed destinations)?",
      {
        true: "Explicit or implied evasion of trade controls, or prohibited goods",
        false: "Ordinary commercial trade content",
      },
    ),
    amount_anomaly: noul(
      "Given this buyer's payment history in the state, is the total amount anomalously high (more than ~30% above their historical average)?",
      {
        true: "The amount clearly exceeds the historical pattern",
        false: "The amount is consistent with history, or no history exists",
      },
    ),
    extraction_q: score(
      "Overall, how reliably was this source message converted into a complete invoice draft?",
      [
        "unusable — key fields missing or contradictory",
        "needs review — several fields uncertain",
        "usable — minor fields uncertain",
        "clean — every field clearly supported by the text",
      ] as const,
    ),
  };
}

export type ExtractionQuestions = ReturnType<typeof extractionQuestions>;

export function intentQuestions() {
  return {
    intent: choice(
      "A buyer replied to an invoice reminder or invoice message. What is the intent of their reply?",
      {
        promise_to_pay: "Commits to paying (mentions a date/soon/already sent money)",
        dispute: "Disputes the invoice — wrong goods, quantity, quality, price, or asks for refund/credit note",
        question: "Asks for clarification (bank details, breakdown, delivery status) without disputing",
        spam: "Irrelevant, promotional, or automated content",
        other: "Anything else that does not clearly fit",
      },
    ),
  };
}

export function guardrailQuestions(claimKeys: { key: string; claim: string }[]) {
  return {
    unsafe_claims: noul(
      "Does this drafted message contain unsafe or inaccurate claims — legal threats, false urgency, invented fees, shaming, or anything not backed by the ledger facts in state?",
      {
        true: "Contains at least one unsafe or unsupported claim",
        false: "Polite, factual, and fully supported by the ledger facts",
      },
    ),
    ...Object.fromEntries(
      claimKeys.map((c) => [
        `cite_${c.key}`,
        choice(`Is the claim "${c.claim}" supported by the ledger facts in state?`, {
          supported: "A ledger fact directly backs this claim",
          unsupported: "No ledger fact backs this claim",
        }),
      ]),
    ),
  };
}

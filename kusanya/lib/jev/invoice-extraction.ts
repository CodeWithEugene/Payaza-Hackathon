import "server-only";
import { askSystemOne, JevUnavailable, jevEnabled } from "./client";
import { extractionQuestions } from "./questions";
import {
  type ExtractedField,
  type ExtractedItem,
  type InvoiceExtractionResult,
} from "./types";
import { majorToMinor, parseAmountToMinor } from "@/lib/money/format";
import { isCurrency, type CurrencyCode } from "@/lib/money/currencies";

/**
 * Invoice extraction pipeline (build.md §7, solution §9):
 *   source text (+ optional OCR) → deterministic pre-parse → ONE batched Jev
 *   call → code-side resolution of every amount/date → typed result with
 *   per-field confidence + snippets.
 *
 * Fallback (Jev down / Demo Mode / timeout): rule-based extraction labeled
 * `demo: true`, model "demo-rules-v1" — never presented as live AI.
 */

// ------------------------------------------------------- deterministic parse --

export interface AmountCandidate {
  key: string;
  raw: string;
  major: number;
  currencyHint: CurrencyCode | null;
  snippet: string;
}

export interface DateCandidate {
  key: string;
  raw: string;
  iso: string; // resolved IN CODE
  snippet: string;
  ambiguous: boolean;
}

export interface Preparsed {
  amounts: AmountCandidate[];
  dates: DateCandidate[];
  emails: string[];
  phones: string[];
}

const AMOUNT_RE =
  /(\b(?:usd|kes|ugx|tzs)\b|\$|\b(?:kshs?|ushs?|tshs?)\b)?\s*(\d{1,3}(?:[,\s]\d{3})+|\d+)(?:\.(\d{1,2}))?\b/gi;
const IGNORE_NUMBERS = new Set(["254", "256", "255", "0"]); // dial codes
const HINT_MAP: Record<string, CurrencyCode> = {
  USD: "USD",
  KES: "KES",
  UGX: "UGX",
  TZS: "TZS",
  $: "USD",
  KSH: "KES",
  KSHS: "KES",
  USH: "UGX",
  USHS: "UGX",
  TSH: "TZS",
  TSHS: "TZS",
};

export function preparse(text: string, today = new Date()): Preparsed {
  const amounts: AmountCandidate[] = [];
  let m: RegExpExecArray | null;
  AMOUNT_RE.lastIndex = 0;
  while ((m = AMOUNT_RE.exec(text)) !== null) {
    const rawNum = m[2]!.replace(/[,\s]/g, "");
    if (IGNORE_NUMBERS.has(rawNum) && !m[1] && !m[3]) continue; // bare phone-ish
    const major = Number(`${rawNum}${m[3] ? `.${m[3]}` : ""}`);
    if (!Number.isFinite(major) || major <= 0) continue;
    const hintRaw = (m[1] ?? "").toUpperCase();
    const before = text.slice(Math.max(0, m.index - 4), m.index).toLowerCase();
    let hint: CurrencyCode | null = HINT_MAP[hintRaw] ?? null;
    if (!hint && before.includes("$")) hint = "USD";
    if (!hint && /ksh/.test(before)) hint = "KES";
    if (!hint && /ush/.test(before)) hint = "UGX";
    if (!hint && /tsh/.test(before)) hint = "TZS";
    amounts.push({
      key: `amt_${amounts.length}`,
      raw: m[0].trim(),
      major,
      currencyHint: hint,
      snippet: text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40).trim(),
    });
    if (amounts.length >= 8) break;
  }

  const dates: DateCandidate[] = [];
  const datePatterns: { re: RegExp; resolve: (m: RegExpExecArray) => string | null; ambiguous?: boolean }[] = [
    { re: /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, resolve: (mm) => nextWeekday(today, mm[1]!) },
    { re: /\bend\s+of\s+(the\s+)?month\b|\beom\b/gi, resolve: () => lastDayOfMonth(today) },
    { re: /\bin\s+(\d{1,2})\s+(day|days|week|weeks)\b/gi, resolve: (mm) => addDays(today, Number(mm[1]) * (mm[2]!.toLowerCase().startsWith("week") ? 7 : 1)) },
    { re: /\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/g, resolve: (mm) => isoFromDmy(Number(mm[1]), Number(mm[2]), Number(mm[3])), ambiguous: true },
    { re: /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s*(\d{4})?\b/gi, resolve: (mm) => isoFromDmyName(Number(mm[1]), mm[2]!, mm[3] ? Number(mm[3]) : today.getFullYear()) },
    { re: /\b(?:by|due|before|on)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, resolve: (mm) => nextWeekday(today, mm[1]!) },
  ];
  for (const p of datePatterns) {
    p.re.lastIndex = 0;
    let dm: RegExpExecArray | null;
    while ((dm = p.re.exec(text)) !== null) {
      const iso = p.resolve(dm);
      if (!iso) continue;
      if (dates.some((d) => d.iso === iso && d.raw === dm![0])) continue;
      dates.push({
        key: `date_${dates.length}`,
        raw: dm[0].trim(),
        iso,
        snippet: text.slice(Math.max(0, dm.index - 40), dm.index + dm[0].length + 40).trim(),
        ambiguous: p.ambiguous ?? false,
      });
      if (dates.length >= 5) break;
    }
  }

  const emails = [...text.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)].map((e) => e[0]);
  const phones = [...text.matchAll(/(?:\+?25[456]|0)\s?7\d{2}[\s-]?\d{3}[\s-]?\d{3}/g)].map((p) => p[0]);
  return { amounts, dates, emails, phones: [...new Set(phones)] };
}

// --------------------------------------------------------------- items parse --

const ITEM_RE =
  /(\d+(?:\.\d+)?)\s*(kg|kgs|tons?|tonnes?|bags?|cartons?|boxes?|crates?|pcs?|units?|pieces?)\s+(?:of\s+)?([A-Za-z][A-Za-z\s-]{2,40}?)\s+(?:@|at)\s+(?:(usd|kes|\$|ksh)\s*)?(\d+(?:[.,]\d{1,2})?)/gi;

export function parseItems(text: string): ExtractedItem[] {
  const items: ExtractedItem[] = [];
  let m: RegExpExecArray | null;
  ITEM_RE.lastIndex = 0;
  while ((m = ITEM_RE.exec(text)) !== null) {
    const qty = Number(m[1]);
    const unit = Number(m[5]!.replace(",", "."));
    if (!Number.isFinite(qty) || !Number.isFinite(unit)) continue;
    const cur = currencyFromToken(m[4]);
    items.push({
      description: `${m[3]!.trim()} (${m[2]!.toLowerCase()})`,
      qty,
      unitPriceMinor: null, // resolved once invoice currency known (resolveItems)
      currency: cur,
      confidence: 0.8,
    });
    // stash unit price on description side-channel: caller recomputes
    (items[items.length - 1] as ExtractedItem & { _unit?: number })._unit = unit;
    if (items.length >= 20) break;
  }
  return items;
}

function currencyFromToken(tok?: string): CurrencyCode | null {
  if (!tok) return null;
  const up = tok.toUpperCase();
  if (up === "$" || up === "USD") return "USD";
  if (up === "KSH" || up === "KES") return "KES";
  return null;
}

// ------------------------------------------------------------------ pipeline --

export interface ExtractionInput {
  text: string;
  ocrText?: string | null;
  buyerCandidates: { id: string; name: string; country?: string }[];
  history?: { averageMinor: number | null; isFirstBuyer: boolean };
}

export async function extractInvoice(
  input: ExtractionInput,
): Promise<InvoiceExtractionResult> {
  const started = Date.now();
  const source = [input.text, input.ocrText].filter(Boolean).join("\n---OCR---\n");
  const pre = preparse(source);
  const items = parseItems(source);

  if (jevEnabled()) {
    try {
      return await jevExtraction(input, source, pre, items, started);
    } catch (err) {
      if (err instanceof JevUnavailable) {
        return ruleExtraction(input, source, pre, items, started, "demo-rules-v1");
      }
      // timeout/API failure → fail-safe to rules, labeled
      console.warn("[jev] extraction fell back to rules:", err);
      return ruleExtraction(input, source, pre, items, started, "demo-rules-v1");
    }
  }
  return ruleExtraction(input, source, pre, items, started, "demo-rules-v1");
}

async function jevExtraction(
  input: ExtractionInput,
  source: string,
  pre: Preparsed,
  items: ExtractedItem[],
  started: number,
): Promise<InvoiceExtractionResult> {
  const questions = extractionQuestions({
    amountKeys: pre.amounts.map((a) => ({
      key: a.key,
      description: `"${a.raw}" — context: …${a.snippet}…`,
    })),
    dateKeys: pre.dates.map((d) => ({
      key: d.key,
      description: `"${d.raw}" → ${d.iso} — context: …${d.snippet}…`,
    })),
    buyerKeys: input.buyerCandidates.map((b) => ({
      key: `buyer_${b.id}`,
      description: `Existing buyer directory entry: ${b.name}${b.country ? ` (${b.country})` : ""}`,
    })),
  });

  const result = await askSystemOne(questions, {
    source_text: source,
    today: new Date().toISOString().slice(0, 10),
    buyer_candidates: input.buyerCandidates,
    merchant_history: input.history ?? { averageMinor: null, isFirstBuyer: true },
    amount_candidates: pre.amounts.map(({ key, raw, snippet }) => ({ key, raw, snippet })),
    date_candidates: pre.dates.map(({ key, raw, iso, snippet }) => ({ key, raw, iso, snippet })),
  });

  const a = result.answers as Record<string, { type: string; choice?: string; noul?: number; score?: number; confidence?: number }>;

  // Buyer — model selects among candidates; id resolved in code.
  const buyerChoice = a.buyer_select?.choice ?? "new";
  const buyerConf = a.buyer_select?.confidence ?? 0.5;
  const matched = input.buyerCandidates.find((b) => `buyer_${b.id}` === buyerChoice);
  const buyer: ExtractedField<string> = matched
    ? { value: matched.name, confidence: buyerConf, snippet: firstMention(source, matched.name), deterministic: false }
    : {
        value: guessNewBuyerName(source),
        confidence: Math.min(buyerConf, 0.6),
        snippet: null,
        deterministic: false,
      };

  // Amount — model SELECTS a candidate; minor units computed in code.
  const amountChoice = a.amount_select?.choice ?? "none";
  const amountCandidate = pre.amounts.find((c) => c.key === amountChoice);
  const currencyAnswer = a.currency_pick?.choice ?? "unknown";
  const currency: ExtractedField<string> = {
    value: isCurrency(currencyAnswer) ? currencyAnswer : (amountCandidate?.currencyHint ?? "USD"),
    confidence: isCurrency(currencyAnswer)
      ? (a.currency_pick?.confidence ?? 0.7)
      : amountCandidate?.currencyHint
        ? 0.75
        : 0.4,
    snippet: amountCandidate?.snippet ?? null,
    deterministic: false,
  };
  const total: ExtractedField<number> = amountCandidate
    ? {
        value: majorToMinor(currency.value as CurrencyCode, amountCandidate.major),
        confidence: a.amount_select?.confidence ?? 0.6,
        snippet: amountCandidate.snippet,
        deterministic: true, // value resolved in code from candidate
      }
    : { value: null, confidence: 0, snippet: null, deterministic: true };

  // Due date — model selects candidate; ISO resolved in code.
  const dateChoice = a.due_date_pick?.choice ?? "none";
  const dateCandidate = pre.dates.find((d) => d.key === dateChoice);
  const dueIsPaymentP = a.due_is_payment?.noul ?? 0.5;
  const dueDate: ExtractedField<string> = dateCandidate
    ? {
        value: dateCandidate.iso,
        confidence: Math.min(a.due_date_pick?.confidence ?? 0.6, dueIsPaymentP, dateCandidate.ambiguous ? 0.55 : 1),
        snippet: dateCandidate.snippet,
        deterministic: true,
      }
    : { value: null, confidence: 0, snippet: null, deterministic: true };

  const firmOrder: ExtractedField<boolean> = {
    value: (a.firm_order?.noul ?? 0.5) >= 0.5,
    confidence: Math.abs((a.firm_order?.noul ?? 0.5) - 0.5) * 2, // distance from coin-flip
    snippet: null,
    deterministic: false,
  };

  const quality = Math.min(1, Math.max(0, (a.extraction_q?.score ?? 1) / 3));

  return {
    buyer,
    buyerCandidateId: matched?.id ?? null,
    items: resolveItems(items, currency.value as CurrencyCode, source),
    total,
    currency,
    dueDate,
    firmOrder,
    quality,
    rawAnswers: { answers: a, usage: result.usage },
    model: result.model,
    durationMs: Date.now() - started,
  };
}

/** Rule-based fallback — labeled demo:true everywhere, model demo-rules-v1. */
export function ruleExtraction(
  input: ExtractionInput,
  source: string,
  pre = preparse(source),
  items = parseItems(source),
  started = Date.now(),
  model = "demo-rules-v1",
): InvoiceExtractionResult {
  // Buyer: first directory candidate whose name (or surname) appears in text.
  const lower = source.toLowerCase();
  const matched = input.buyerCandidates.find((b) =>
    b.name.toLowerCase().split(/\s+/).some((tok) => tok.length > 3 && lower.includes(tok)),
  );
  const buyer: ExtractedField<string> = matched
    ? { value: matched.name, confidence: 0.92, snippet: firstMention(source, matched.name), deterministic: false, demo: true }
    : { value: guessNewBuyerName(source), confidence: 0.5, snippet: null, deterministic: false, demo: true };

  // Amount: score candidates — totalish word BEFORE the number (+2), currency
  // hint (+1); tie-break by larger amount, then later position (totals come
  // last). Unit prices ("USD 2.30 per kg") lose to "total USD 1,150".
  const totalish = /(total|invoice|amount|pay|due|balance)/i;
  const scored = pre.amounts.map((c, idx) => {
    const low = c.snippet.toLowerCase();
    const at = low.lastIndexOf(c.raw.toLowerCase());
    const before = at >= 0 ? low.slice(0, at) : low;
    let score = 0;
    if (totalish.test(before)) score += 2;
    if (c.currencyHint) score += 1;
    return { c, idx, score };
  });
  scored.sort((a, b) => b.score - a.score || b.c.major - a.c.major || b.idx - a.idx);
  const pick = scored[0]?.c;
  const currencyGuess: CurrencyCode =
    pick?.currencyHint ??
    (/\busd|\$/i.test(source) ? "USD" : /\bkes|ksh/i.test(source) ? "KES" : /\bugx|ush/i.test(source) ? "UGX" : /\btzs|tsh/i.test(source) ? "TZS" : "USD");
  const total: ExtractedField<number> = pick
    ? {
        value: majorToMinor(currencyGuess, pick.major),
        confidence: pick.currencyHint ? 0.88 : totalish.test(pick.snippet) ? 0.72 : 0.45,
        snippet: pick.snippet,
        deterministic: true,
        demo: true,
      }
    : { value: null, confidence: 0, snippet: null, deterministic: true, demo: true };

  const due = pre.dates[0];
  const dueDate: ExtractedField<string> = due
    ? { value: due.iso, confidence: due.ambiguous ? 0.5 : 0.8, snippet: due.snippet, deterministic: true, demo: true }
    : { value: null, confidence: 0, snippet: null, deterministic: true, demo: true };

  const firmWords = /(please send|kindly send|confirm(ed)? (the )?order|we('| a)?ll take|order(ing)?|ship|deliver|proceed)/i;
  const enquiryWords = /(how much|what('| i)s the price|do you have|availab|quote|can you send me (the )?price)/i;
  const firmP = firmWords.test(source) ? 0.9 : enquiryWords.test(source) ? 0.15 : 0.5;
  const firmOrder: ExtractedField<boolean> = {
    value: firmP >= 0.5,
    confidence: Math.abs(firmP - 0.5) * 2,
    snippet: null,
    deterministic: true,
    demo: true,
  };

  const found = [buyer.value, total.value, dueDate.value, items.length > 0].filter(Boolean).length;
  const quality = found / 4;

  return {
    buyer,
    buyerCandidateId: matched?.id ?? null,
    items: resolveItems(items, currencyGuess, source),
    total,
    currency: { value: currencyGuess, confidence: pick?.currencyHint ? 0.88 : 0.6, snippet: null, deterministic: false, demo: true },
    dueDate,
    firmOrder,
    quality,
    rawAnswers: { mode: "rule-fallback", candidates: { amounts: pre.amounts.length, dates: pre.dates.length } },
    model,
    durationMs: Date.now() - started,
  };
}

// ------------------------------------------------------------------- helpers --

function resolveItems(items: ExtractedItem[], currency: CurrencyCode, _source: string): ExtractedItem[] {
  return items.map((it) => {
    const unit = (it as ExtractedItem & { _unit?: number })._unit;
    const unitCurrency = (it.currency as CurrencyCode | null) ?? currency;
    return {
      ...it,
      currency,
      unitPriceMinor: unit != null ? majorToMinor(unitCurrency, unit) : null,
    };
  });
}

function firstMention(text: string, name: string): string | null {
  const tok = name.toLowerCase().split(/\s+/).find((t) => t.length > 3);
  if (!tok) return null;
  const idx = text.toLowerCase().indexOf(tok);
  if (idx < 0) return null;
  return text.slice(Math.max(0, idx - 30), idx + tok.length + 50).trim();
}

/** "attn Susan" / "Dubai Fresh Co" style name guess for NEW buyers. */
function guessNewBuyerName(text: string): string | null {
  const attn = text.match(/\battn\.?\s*:?\s*([A-Z][\w'&.-]+(?:\s+[A-Z][\w'&.-]+)*)/);
  if (attn) return attn[1]!;
  const company = text.match(/([A-Z][\w'&.-]+(?:\s+[A-Z][\w'&.-]+){0,4}\s+(?:Ltd|LLC|Ltda|Limited|Co\.?|Company|Enterprises|Trading|Exports?|Farms?|Fresh))/);
  if (company) return company[1]!.trim();
  return null;
}

// --------------------------------------------------------------- date math --

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function nextWeekday(from: Date, name: string): string | null {
  const target = WEEKDAYS.indexOf(name.toLowerCase());
  if (target < 0) return null;
  const d = new Date(from);
  do {
    d.setUTCDate(d.getUTCDate() + 1);
  } while (d.getUTCDay() !== target);
  return d.toISOString().slice(0, 10);
}

function lastDayOfMonth(from: Date): string {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
}

function addDays(from: Date, n: number): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** dd/mm/yyyy (Kenyan convention) — flagged ambiguous for confidence band. */
function isoFromDmy(d: number, m: number, y: number): string | null {
  if (m > 12 || d > 31) return null;
  const year = y < 100 ? 2000 + y : y;
  const date = new Date(Date.UTC(year, m - 1, d));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function isoFromDmyName(d: number, mon: string, y: number): string | null {
  const m = MONTHS.indexOf(mon.toLowerCase().slice(0, 3)) + 1;
  return m ? isoFromDmy(d, m, y) : null;
}

/** Re-export for tests. */
export { parseAmountToMinor };

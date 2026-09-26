import type { CurrencyCode } from "./currencies";

/**
 * FX helpers — quotes, validity windows, honest settlement ETAs.
 *
 * IMPORTANT (solution §18, research §4.7): Payaza's exact USD→KES conversion
 * mechanics are an open question for mentors (build.md §17.1). Until confirmed,
 * Kusanya shows INDICATIVE rates (from config below, refreshed manually) and
 * labels every pre-settlement figure "estimate". Actual settled amounts always
 * come from webhook fields — never from these helpers.
 */

export interface FxQuote {
  pair: `${CurrencyCode}/${CurrencyCode}`;
  /** numeric(12,6)-style string */
  rate: string;
  quotedAt: string; // ISO
  expiresAt: string; // ISO — UI shows validity window (transparency panel)
  source: "indicative" | "payaza-actual";
}

/** Indicative rates for Demo Mode & estimates (kept conservative). */
const INDICATIVE_RATES: Record<string, string> = {
  "USD/KES": "128.900000",
  "KES/UGX": "10.350000",
  "KES/TZS": "18.400000",
  "USD/UGX": "3720.000000",
  "USD/TZS": "2650.000000",
};

const QUOTE_TTL_MINUTES = 30;

export function indicativeQuote(
  from: CurrencyCode,
  to: CurrencyCode,
  now: Date = new Date(),
): FxQuote | null {
  const key = `${from}/${to}` as const;
  const rate = INDICATIVE_RATES[key];
  if (!rate) return null;
  const expiresAt = new Date(now.getTime() + QUOTE_TTL_MINUTES * 60_000);
  return {
    pair: key,
    rate,
    quotedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    source: "indicative",
  };
}

/**
 * Settlement ETA from Payaza's published SLAs (research §4.8): local T+1,
 * USD collections T+3–5 business days. Returns a label + target date range —
 * the UI shows these honestly (never promises same-day for USD).
 */
export interface SettlementEta {
  label: string; // "by Thu 16:00" style computed client-side from `earliest`
  earliest: Date;
  latest: Date;
  basis: string; // SLA text for tooltip
}

export function settlementEta(
  collectionCurrency: CurrencyCode,
  confirmedAt: Date = new Date(),
): SettlementEta {
  if (collectionCurrency === "USD") {
    return {
      label: "T+3–5 business days",
      earliest: addBusinessDays(confirmedAt, 3),
      latest: addBusinessDays(confirmedAt, 5),
      basis: "Payaza settles USD card collections in T+3–5 business days",
    };
  }
  return {
    label: "T+1 (next business day)",
    earliest: addBusinessDays(confirmedAt, 1),
    latest: addBusinessDays(confirmedAt, 1),
    basis: "Payaza settles local-currency collections T+1",
  };
}

function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

import type { CurrencyCode } from "./currencies";
import { minorToMajor } from "./format";

/**
 * Fee math for the transparency waterfall (solution §10, build.md §8.12).
 * All inputs/outputs integer minor units. BPS = basis points (1% = 100).
 * Rounding: half-up, deterministic — unit-tested to 100% (build.md §13).
 */

export const KUSANYA_TAKE_BPS = 150; // 1.5% platform take rate
export const PRO_TIER_KES_MONTHLY_MINOR = 150_000; // KES 1,500.00
export const SPLIT_VOLUME_BPS = 25; // 0.25% on auto-split volume

/** bps fee of an amount, half-up. */
export function feeBps(amountMinor: number, bps: number): number {
  return roundHalfUp((amountMinor * bps) / 10_000);
}

/** Percentage fee (e.g. 1.9 → 1.9%), half-up. Used for pass-through rail fees. */
export function feePercent(amountMinor: number, percent: number): number {
  return roundHalfUp((amountMinor * percent) / 100);
}

export interface WaterfallInput {
  grossMinor: number; // what the buyer pays (invoice currency)
  railFeeMinor: number; // Payaza collection fee (pass-through, from webhook when settled)
  kusanyaFeeBps?: number; // platform take; 0 when bundled into rail fee display
  fxRate?: string; // numeric(12,6) string, quote currency per invoice currency
  settleCurrency?: CurrencyCode; // e.g. KES
  splits?: { name: string; bpsOrMinor: { kind: "bps"; value: number } | { kind: "minor"; value: number } }[];
}

export interface WaterfallLine {
  label: string;
  minor: number; // signed, in the line's currency
  currency: CurrencyCode;
  kind: "gross" | "fee" | "fx" | "split" | "net";
  note?: string;
}

/**
 * Build the itemized waterfall lines: gross → rail fee → Kusanya fee → FX →
 * splits → net. Until settlement, fee/FX figures are ESTIMATES (marked in
 * `note`); after webhook they are replaced with actuals (honest-states rule).
 */
export function buildWaterfall(
  input: WaterfallInput,
  invoiceCurrency: CurrencyCode,
  estimated: boolean,
): WaterfallLine[] {
  const lines: WaterfallLine[] = [];
  const kusanyaBps = input.kusanyaFeeBps ?? KUSANYA_TAKE_BPS;

  lines.push({
    label: "Gross",
    minor: input.grossMinor,
    currency: invoiceCurrency,
    kind: "gross",
  });

  let running = input.grossMinor;

  if (input.railFeeMinor > 0) {
    running -= input.railFeeMinor;
    lines.push({
      label: "Payaza fee",
      minor: -input.railFeeMinor,
      currency: invoiceCurrency,
      kind: "fee",
      note: estimated ? "estimate — actual from settlement webhook" : undefined,
    });
  }

  const kusanyaFee = feeBps(running, kusanyaBps);
  if (kusanyaFee > 0) {
    running -= kusanyaFee;
    lines.push({
      label: `Kusanya fee (${(kusanyaBps / 100).toFixed(2).replace(/\.?0+$/, "")}%)`,
      minor: -kusanyaFee,
      currency: invoiceCurrency,
      kind: "fee",
      note: estimated ? "estimate" : undefined,
    });
  }

  let netCurrency: CurrencyCode = invoiceCurrency;
  if (input.fxRate && input.settleCurrency && input.settleCurrency !== invoiceCurrency) {
    const converted = applyRate(running, input.fxRate);
    lines.push({
      label: `FX → ${input.settleCurrency}`,
      minor: converted,
      currency: input.settleCurrency,
      kind: "fx",
      note: estimated ? `indicative rate ${input.fxRate}` : `rate ${input.fxRate}`,
    });
    running = converted;
    netCurrency = input.settleCurrency;
  }

  for (const split of input.splits ?? []) {
    const amt =
      split.bpsOrMinor.kind === "bps"
        ? feeBps(running, split.bpsOrMinor.value)
        : split.bpsOrMinor.value;
    if (amt > 0) {
      running -= amt;
      lines.push({
        label: `${split.name} split`,
        minor: -amt,
        currency: netCurrency,
        kind: "split",
      });
    }
  }

  lines.push({
    label: "Net to you",
    minor: running,
    currency: netCurrency,
    kind: "net",
    note: estimated ? "estimate until settlement completes" : undefined,
  });
  return lines;
}

/**
 * Apply an FX rate (numeric(12,6) string like "128.900000") to minor units
 * using exact BigInt math — rate scaled to 6 decimals, half-up rounding.
 * NOTE: minor-unit exponents must match between currencies for a pure rate
 * multiply (USD→KES both 2 decimals ✓). For 0-decimal currencies the caller
 * converts through major units (see convertMinor).
 */
export function applyRate(amountMinor: number, rate: string): number {
  if (!/^\d+(\.\d{1,6})?$/.test(rate)) {
    throw new Error(`money: invalid fx rate "${rate}"`);
  }
  const scaled = BigInt(Math.round(Number(rate) * 1_000_000));
  const product = BigInt(amountMinor) * scaled;
  const q = product / 1_000_000n;
  const r = product % 1_000_000n;
  const absQ = q < 0n ? q - (r * 2n >= 1_000_000n ? -1n : 0n) : q + (r * 2n >= 1_000_000n ? 1n : 0n);
  return Number(absQ);
}

/**
 * Convert minor units between currencies with possibly different exponents
 * (e.g. USD(2) → UGX(0)): major = minor/10^dFrom; result = major*rate*10^dTo.
 * Exact BigInt path, half-up.
 */
export function convertMinor(
  amountMinor: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rate: string,
): number {
  if (from === to) return amountMinor;
  const dFrom = decimalCount(from);
  const dTo = decimalCount(to);
  if (!/^\d+(\.\d{1,6})?$/.test(rate)) {
    throw new Error(`money: invalid fx rate "${rate}"`);
  }
  const rateScaled = BigInt(Math.round(Number(rate) * 1_000_000));
  const product = BigInt(amountMinor) * rateScaled; // minor-from × rate×1e6
  // target minor = product / 1e6 × 10^(dTo-dFrom)
  let divisor = 1_000_000n;
  let multiplier = 1n;
  if (dTo >= dFrom) multiplier = 10n ** BigInt(dTo - dFrom);
  else divisor *= 10n ** BigInt(dFrom - dTo);
  const q = product * multiplier;
  const result = q / divisor;
  const rem = q % divisor;
  const rounded = rem * 2n >= divisor ? result + 1n : result;
  return Number(rounded);
}

function decimalCount(c: CurrencyCode): number {
  return c === "UGX" || c === "TZS" ? 0 : 2;
}

/** Major-units preview helper for fee calculators (UI, never storage). */
export function previewMajor(currency: CurrencyCode, minor: number): number {
  return minorToMajor(currency, minor);
}

function roundHalfUp(n: number): number {
  return Math.floor(n + 0.5);
}

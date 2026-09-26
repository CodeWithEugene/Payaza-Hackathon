/**
 * Currency metadata — the four MVP currencies (build.md §5, research §4.2/4.3).
 *
 * Money storage contract (whole codebase):
 *  - DB columns: numeric(18,2), values are MINOR UNITS as integer-valued strings
 *    (e.g. "115000" = USD 1,150.00 — decimals always .00, minor units never float).
 *  - lib/money math: JavaScript integer `number`s (minor units). Safe below 2^53
 *    (≈ 90 trillion USD) — every realistic invoice amount.
 *  - Boundaries: parse/format only through this module. NEVER parseFloat raw.
 */

export const CURRENCIES = {
  USD: { code: "USD", decimals: 2, symbol: "$", name: "US Dollar" },
  KES: { code: "KES", decimals: 2, symbol: "KSh", name: "Kenyan Shilling" },
  UGX: { code: "UGX", decimals: 0, symbol: "USh", name: "Ugandan Shilling" },
  TZS: { code: "TZS", decimals: 0, symbol: "TSh", name: "Tanzanian Shilling" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

export function isCurrency(v: string): v is CurrencyCode {
  return v in CURRENCIES;
}

export function decimals(currency: CurrencyCode): number {
  return CURRENCIES[currency].decimals;
}

/** 10^decimals — minor→major divisor. */
export function minorFactor(currency: CurrencyCode): number {
  return 10 ** decimals(currency);
}

export function currencySymbol(currency: CurrencyCode): string {
  return CURRENCIES[currency].symbol;
}

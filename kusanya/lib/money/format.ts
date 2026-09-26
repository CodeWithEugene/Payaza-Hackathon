import {
  type CurrencyCode,
  minorFactor,
  currencySymbol,
} from "./currencies";

/**
 * Formatting & parsing — the ONLY places where minor units meet strings.
 * Integer math only; no floats ever stored or compared.
 */

/** DB numeric(18,2) string ("115000" | "115000.00") → integer minor units. */
export function fromNumericColumn(value: string | null): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  if (!Number.isInteger(n)) {
    // Should never happen (contract: integer-valued minor units). Fail loud.
    throw new Error(`money: non-integer minor units in numeric column: ${value}`);
  }
  return n;
}

/** Integer minor units → DB numeric column string. */
export function toNumericColumn(minor: number): string {
  assertSafeMinor(minor);
  return String(minor);
}

/** Parse a user-entered amount ("1150", "1,150.00") → integer minor units. */
export function parseAmountToMinor(
  currency: CurrencyCode,
  input: string,
): number | null {
  const cleaned = input.replace(/[,\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const factor = minorFactor(currency);
  const [whole, frac = ""] = cleaned.split(".");
  const allowed = Math.log10(factor);
  if (frac.length > allowed) return null; // too many decimals for currency
  const minor = Number(whole) * factor + Number(frac.padEnd(allowed, "0"));
  if (!Number.isInteger(minor)) return null;
  assertSafeMinor(minor);
  return minor;
}

/** Integer minor units → display string: "1,150.00" (no symbol). */
export function formatMinor(currency: CurrencyCode, minor: number): string {
  assertSafeMinor(minor);
  const factor = minorFactor(currency);
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / factor);
  const frac = String(abs % factor).padStart(Math.log10(factor), "0");
  const wholeFmt = whole.toLocaleString("en-US");
  return Math.log10(factor) === 0
    ? `${sign}${wholeFmt}`
    : `${sign}${wholeFmt}.${frac}`;
}

/** Integer minor units → money display: "USD 1,150.00" / "KES 140,113.50". */
export function formatMoney(currency: CurrencyCode, minor: number): string {
  return `${currency} ${formatMinor(currency, minor)}`;
}

/** Symbol form for compact UI: "KSh 140,113.50". */
export function formatMoneySymbol(
  currency: CurrencyCode,
  minor: number,
): string {
  return `${currencySymbol(currency)} ${formatMinor(currency, minor)}`;
}

/** Major-units number for the Payaza SDK (checkout_amount must be a number). */
export function minorToMajor(currency: CurrencyCode, minor: number): number {
  assertSafeMinor(minor);
  const factor = minorFactor(currency);
  return Math.round(minor) / factor;
}

/** Major-units number (SDK inputs) → minor units, rounding half-up. */
export function majorToMinor(currency: CurrencyCode, major: number): number {
  const factor = minorFactor(currency);
  const minor = Math.round(major * factor);
  assertSafeMinor(minor);
  return minor;
}

function assertSafeMinor(minor: number): void {
  if (!Number.isInteger(minor) || Math.abs(minor) > Number.MAX_SAFE_INTEGER) {
    throw new Error(`money: unsafe minor-unit value: ${minor}`);
  }
}

import { cn } from "@/lib/utils";

/**
 * Money display — mono font for all amounts (build.md §10: numbers never
 * lie, never jitter). Formatting mirrors lib/money/format (server) so SSR
 * and client agree to the cent.
 */

const SYMBOLS: Record<string, string> = { USD: "$", KES: "KSh ", UGX: "USh ", TZS: "TSh " };
const DECIMALS: Record<string, number> = { USD: 2, KES: 2, UGX: 0, TZS: 0 };

export function formatAmountMinor(minor: number | string, currency: string): string {
  const m = Number(minor);
  const d = DECIMALS[currency] ?? 2;
  const major = m / Math.pow(10, d);
  return (
    (SYMBOLS[currency] ?? `${currency} `) +
    major.toLocaleString("en-KE", { minimumFractionDigits: d, maximumFractionDigits: d })
  );
}

export function Amount({
  minor,
  currency,
  className,
  signed,
}: {
  minor: number | string;
  currency: string;
  className?: string;
  signed?: boolean;
}) {
  const value = Number(minor);
  const sign = signed && value > 0 ? "+" : "";
  return (
    <span className={cn("font-mono tabular-nums", className)} data-amount={String(value)}>
      {sign}
      {formatAmountMinor(value, currency)}
    </span>
  );
}

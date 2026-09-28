import { formatMoney } from "@/lib/money/format";
import { isCurrency } from "@/lib/money/currencies";

/**
 * Display-string helpers for export rows. Money goes through
 * lib/money/format (integer minor units, no float math); anything that is
 * not a known currency is labelled honestly instead of guessed.
 */

/** Minor units (DB numeric string or integer) → "USD 1,150.00"; "" when absent. */
export function moneyText(currency: string, minor: string | number | null | undefined): string {
  if (minor === null || minor === undefined || minor === "") return "";
  const n = typeof minor === "number" ? minor : Number(minor);
  if (!Number.isFinite(n)) return "";
  // numeric(18,2) columns hold integer-valued minor units ("115000.00").
  const whole = Math.round(n);
  return isCurrency(currency) ? formatMoney(currency, whole) : `${currency} ${whole} (minor units)`;
}

const DATE_FMT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
const DATE_TIME_FMT: Intl.DateTimeFormatOptions = {
  ...DATE_FMT,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

export function dateText(d: Date | null | undefined, timeZone?: string): string {
  return d ? new Intl.DateTimeFormat("en-GB", { ...DATE_FMT, timeZone }).format(d) : "";
}

export function dateTimeText(d: Date | null | undefined, timeZone?: string): string {
  return d ? new Intl.DateTimeFormat("en-GB", { ...DATE_TIME_FMT, timeZone }).format(d) : "";
}

/** Payment rails in plain English (the rails Kusanya rides on). */
export const CHANNEL_LABELS: Record<string, string> = {
  card: "Card (Payaza Checkout)",
  momo_ke: "M-Pesa Kenya",
  momo_ug: "MTN/Airtel Uganda",
  momo_tz: "M-Pesa/Tigo Tanzania",
  mpesa_payout: "M-Pesa payout",
  kepss_payout: "Bank payout (kepss)",
  payment_link: "Payment link",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  virtual_account: "Virtual account",
  manual: "Manual",
};

export function channelText(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  ready: "Ready To Send",
  sent: "Sent",
  partially_paid: "Partially Paid",
  paid: "Paid",
  settling: "Settling",
  settled: "Settled",
  paying_out: "Paying Out",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  review: "Needs Review",
  on_hold: "On Hold",
  initialized: "Initialized",
  pending: "Pending",
  reversed: "Reversed",
  escrow: "Escrow",
};

export function statusText(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export { cn } from "cn";
import { ulid } from "ulid";

/**
 * Prefixed monotonic ids (build.md §3): sortable, unguessable (26 chars of
 * Crockford base32 entropy from ulid), safe for public tokens and references.
 */
export type IdPrefix =
  | "biz" // businesses
  | "rail" // payout_rails
  | "buy" // buyers
  | "inv" // invoices
  | "itm" // invoice_items
  | "txn" // transactions
  | "pay" // payouts
  | "spb" // split_beneficiaries
  | "isp" // invoice_splits
  | "rsk" // risk_assessments
  | "ext" // ai_extractions
  | "wev" // webhook_events
  | "rem" // reminders
  | "aud" // audit_log
  | "tgl" // telegram_links
  | "key" // api_keys
  | "tok"; // public buyer-facing tokens

export function newId(prefix: IdPrefix): string {
  return `${prefix}_${ulid().toLowerCase()}`;
}

/** Public unguessable token for buyer invoice pages (/i/[token]). */
export function newPublicToken(): string {
  return newId("tok");
}

/**
 * Merchant reference for Payaza transactions — unique per attempt, carried
 * through webhooks. Format: KSN-<ulid> (uppercase, collision-tested in unit
 * tests per security checklist §12).
 */
export function newMerchantReference(): string {
  return `KSN-${ulid()}`;
}

/** Human invoice numbers: KSN-2026-0042 (per-business sequence). */
export function humanInvoiceNumber(year: number, seq: number): string {
  return `KSN-${year}-${String(seq).padStart(4, "0")}`;
}

/** Mask account numbers/phones for UI: keep last 4. */
export function mask(value: string): string {
  if (value.length <= 4) return value;
  return `${"•".repeat(Math.min(value.length - 4, 8))}${value.slice(-4)}`;
}

/**
 * USSD screen helpers (pure, unit-tested in tests/ussd.test.ts).
 * Africa's Talking contract: reply "CON <text>" to keep the session open or
 * "END <text>" to close it. `text` arrives as every answer so far joined by
 * "*" ("3*2*1*5000"). Screens stay under AT's ~182 character limit, and copy
 * follows the house rules (no em or en dashes).
 */

export const USSD_MAX_CHARS = 182;

function clip(text: string): string {
  return text.length <= USSD_MAX_CHARS ? text : `${text.slice(0, USSD_MAX_CHARS - 1)}…`;
}

export function con(text: string): string {
  return `CON ${clip(text)}`;
}

export function end(text: string): string {
  return `END ${clip(text)}`;
}

/** "3*2*1*5000" → ["3", "2", "1", "5000"]; "" → []. Trims stray spaces. */
export function steps(text: string | null | undefined): string[] {
  const raw = (text ?? "").trim();
  return raw === "" ? [] : raw.split("*").map((s) => s.trim());
}

export function menu(title: string, options: string[]): string {
  return con([title, ...options.map((o, i) => `${i + 1}. ${o}`)].join("\n"));
}

/** Short money label for tight screens: "KES 48,500" when whole, else 2 dp. */
export function shortMoney(label: string): string {
  return label.replace(/\.00$/, "");
}

/** Invoice number typed on a keypad: "8" or "2026-0008" or "KSN20260008" → "KSN-2026-0008". */
export function normalizeInvoiceNumber(input: string, year = new Date().getUTCFullYear()): string | null {
  const digits = input.replace(/[^\d]/g, "");
  if (digits.length === 0 || digits.length > 8) return null;
  if (digits.length <= 4) return `KSN-${year}-${digits.padStart(4, "0")}`;
  if (digits.length === 8) return `KSN-${digits.slice(0, 4)}-${digits.slice(4)}`;
  return null;
}

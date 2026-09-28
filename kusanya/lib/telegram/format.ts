/**
 * Pure helpers for the Telegram bot: HTML escaping, command/callback parsing
 * and reply text. No I/O, so it is unit-tested (tests/telegram-format.test.ts).
 * Copy rules: button labels Title Case; no em or en dashes in any text.
 */

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type BotCommand =
  | { kind: "start"; code: string | null }
  | { kind: "help" }
  | { kind: "invoices" }
  | { kind: "unlink" }
  | { kind: "unknown_command"; name: string }
  | { kind: "order"; text: string };

/** "/start abc", "/help@kusanya_invoice_bot", or free text (an order). */
export function parseMessage(text: string): BotCommand {
  const trimmed = text.trim();
  const match = /^\/([a-z_]+)(?:@\w+)?(?:\s+(.*))?$/is.exec(trimmed);
  if (!match) return { kind: "order", text: trimmed };
  const name = match[1]!.toLowerCase();
  const arg = match[2]?.trim() || null;
  switch (name) {
    case "start":
      return { kind: "start", code: arg && /^[A-Za-z0-9_-]{8,64}$/.test(arg) ? arg : null };
    case "help":
      return { kind: "help" };
    case "invoices":
      return { kind: "invoices" };
    case "unlink":
      return { kind: "unlink" };
    default:
      return { kind: "unknown_command", name };
  }
}

export type CallbackAction = { action: "send" | "discard"; invoiceId: string };

export function encodeCallback(action: CallbackAction["action"], invoiceId: string): string {
  return `${action}:${invoiceId}`; // ≤ 64 bytes: "discard:" + 30-char id
}

export function parseCallback(data: string | undefined): CallbackAction | null {
  const match = /^(send|discard):(inv_[0-9a-z]{26})$/.exec(data ?? "");
  return match ? { action: match[1] as CallbackAction["action"], invoiceId: match[2]! } : null;
}

export const HELP_TEXT = [
  "<b>Kusanya invoice bot</b>",
  "",
  "Forward or paste a buyer's order here and I turn it into a Kusanya invoice with a Payaza payment link.",
  "",
  "Include the buyer, what they ordered and the total, for example:",
  "<i>Hi, this is Susan from Dubai Fresh FZE. Please send 500kg French beans at $2.30/kg, total USD 1,150. Payment in 5 days.</i>",
  "",
  "/invoices  your latest invoices",
  "/unlink  disconnect this chat",
  "/help  this message",
].join("\n");

export const NOT_LINKED_TEXT = [
  "<b>Welcome to Kusanya</b>",
  "",
  "Connect this chat to your Kusanya account first: open Kusanya, go to <b>Settings</b>, then <b>Telegram</b>, and tap <b>Connect Telegram</b>.",
  "",
  "After that, send me any buyer order and I will draft the invoice.",
].join("\n");

export interface OrderSummary {
  number: string;
  buyerName: string;
  items: { description: string; qty: string }[];
  totalLabel: string;
  dueLabel: string;
  quality: number;
  engine: string;
}

export function orderSummaryHtml(s: OrderSummary): string {
  const items = s.items.length
    ? s.items.slice(0, 6).map((i) => `• ${escapeHtml(i.description)} × ${escapeHtml(i.qty)}`).join("\n")
    : "• (no line items found)";
  return [
    `<b>Invoice ${escapeHtml(s.number)} is ready</b>`,
    "",
    `<b>Buyer:</b> ${escapeHtml(s.buyerName)}`,
    items,
    `<b>Total:</b> ${escapeHtml(s.totalLabel)}`,
    `<b>Due:</b> ${escapeHtml(s.dueLabel)}`,
    "",
    `Read by ${escapeHtml(s.engine)} with ${Math.round(s.quality * 100)}% overall confidence. Risk screen passed and the Payaza payment link is ready.`,
  ].join("\n");
}

import "server-only";
import { createHmac } from "node:crypto";
import { env } from "@/lib/config/env";

/**
 * Minimal Telegram Bot API client (https://core.telegram.org/bots/api).
 * Server-only: the bot token never leaves the server. HTML parse mode;
 * callers escape dynamic text with escapeHtml (lib/telegram/format.ts).
 */

const API = "https://api.telegram.org";
const TIMEOUT_MS = 10_000;

export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export type InlineKeyboard = InlineButton[][];

export class TelegramError extends Error {
  constructor(readonly method: string, readonly description: string) {
    super(`Telegram ${method} failed: ${description}`);
    this.name = "TelegramError";
  }
}

export function telegramConfigured(): boolean {
  return env.TELEGRAM_BOT_TOKEN.length > 0;
}

/**
 * Secret Telegram echoes in X-Telegram-Bot-Api-Secret-Token on every webhook
 * call. Derived from the bot token unless TELEGRAM_WEBHOOK_SECRET is set, so
 * there is one less secret to manage. Allowed charset: A-Z a-z 0-9 _ -.
 */
export function webhookSecret(): string {
  if (env.TELEGRAM_WEBHOOK_SECRET) return env.TELEGRAM_WEBHOOK_SECRET;
  return createHmac("sha256", env.TELEGRAM_BOT_TOKEN).update("kusanya-telegram-webhook").digest("hex");
}

export async function callTelegram<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  if (!telegramConfigured()) throw new TelegramError(method, "TELEGRAM_BOT_TOKEN missing");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!data.ok) throw new TelegramError(method, data.description ?? `HTTP ${res.status}`);
    return data.result as T;
  } finally {
    clearTimeout(timer);
  }
}

export function sendMessage(chatId: string | number, html: string, keyboard?: InlineKeyboard) {
  return callTelegram<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
}

/** Ask for the user's own phone number (Telegram's native "share contact" button). */
export function requestPhone(chatId: string | number, html: string) {
  return callTelegram<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    reply_markup: {
      keyboard: [[{ text: "📱 Share My Phone Number", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

/** Plain message that also clears a reply keyboard left by requestPhone. */
export function sendMessageClearingKeyboard(chatId: string | number, html: string) {
  return callTelegram<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: { remove_keyboard: true },
  });
}

export function editMessage(chatId: string | number, messageId: number, html: string, keyboard?: InlineKeyboard) {
  return callTelegram("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: html,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: keyboard ?? [] },
  });
}

export function answerCallback(callbackQueryId: string, text?: string) {
  return callTelegram("answerCallbackQuery", { callback_query_id: callbackQueryId, ...(text ? { text } : {}) });
}

export function sendTyping(chatId: string | number) {
  return callTelegram("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => undefined);
}

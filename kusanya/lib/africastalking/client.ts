import "server-only";
import { createHmac } from "node:crypto";
import { env } from "@/lib/config/env";

/**
 * Africa's Talking REST client (SMS) plus callback authentication.
 * AT_API_KEY (or the older AFRICASTALKING_KEY) with username "sandbox" talks to
 * the sandbox API; any other username talks to live. Never logs the key.
 */

const SEND_TIMEOUT_MS = 10_000;

export function atApiKey(): string {
  return env.AT_API_KEY || env.AFRICASTALKING_KEY;
}

export function atUsername(): string {
  return env.AT_API_KEY ? env.AT_USERNAME : env.AFRICASTALKING_USER || env.AT_USERNAME;
}

export function atConfigured(): boolean {
  return atApiKey().length > 0;
}

function apiBase(): string {
  return atUsername() === "sandbox" ? "https://api.sandbox.africastalking.com" : "https://api.africastalking.com";
}

/**
 * AT does not sign USSD/SMS callbacks, so the callback URLs we register carry
 * a secret ?token=. Derived from the API key unless AT_CALLBACK_TOKEN is set.
 */
export function callbackToken(): string {
  if (env.AT_CALLBACK_TOKEN) return env.AT_CALLBACK_TOKEN;
  return createHmac("sha256", atApiKey()).update("kusanya-at-callback").digest("hex").slice(0, 32);
}

export async function atSendSms(to: string, message: string): Promise<boolean> {
  const body = new URLSearchParams({ username: atUsername(), to, message });
  if (env.AT_SENDER_ID) body.set("from", env.AT_SENDER_ID);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(`${apiBase()}/version1/messaging`, {
      method: "POST",
      headers: { apiKey: atApiKey(), Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => null)) as {
      SMSMessageData?: { Recipients?: { status?: string; statusCode?: number }[]; Message?: string };
    } | null;
    const recipient = data?.SMSMessageData?.Recipients?.[0];
    const ok = res.ok && recipient !== undefined && (recipient.statusCode === 100 || recipient.statusCode === 101 || recipient.statusCode === 102);
    if (!ok) console.warn("[sms] africastalking", res.status, data?.SMSMessageData?.Message ?? recipient?.status ?? "no recipient");
    return ok;
  } finally {
    clearTimeout(timer);
  }
}

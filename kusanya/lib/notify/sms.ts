import "server-only";
import { atConfigured, atSendSms, atUsername } from "@/lib/africastalking/client";
import { SEED_PHONES } from "@/lib/notify/seed-emails";

/**
 * SMS sender: Africa's Talking when configured (sandbox or live), else the
 * demo outbox. Every message is recorded in the in-app outbox. Never throws:
 * a notification failure must not fail a money flow.
 */

export interface SmsOutboxEntry {
  to: string;
  message: string;
  at: string;
}

const globalSms = globalThis as unknown as { _kusanyaSms?: SmsOutboxEntry[] };
export function smsOutbox(): SmsOutboxEntry[] {
  globalSms._kusanyaSms ??= [];
  return globalSms._kusanyaSms;
}

/** E.164 with a leading +, e.g. "+254712345678". */
export function toE164(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.startsWith("0") && digits.length === 10) return `+254${digits.slice(1)}`;
  return `+${digits}`;
}

export async function sendSms(to: string, message: string): Promise<{ ok: boolean; demo: boolean }> {
  const phone = toE164(to);
  smsOutbox().unshift({ to: phone, message, at: new Date().toISOString() });
  // Sandbox SMS only reach the AT simulator. On a live account, seeded demo
  // numbers (real-looking) stay outbox-only so resets never text strangers.
  const blocked = atUsername() !== "sandbox" && SEED_PHONES.has(phone);
  if (!atConfigured() || blocked) {
    console.log(`[demo-sms → ${phone}] ${message}`);
    return { ok: true, demo: true };
  }
  try {
    return { ok: await atSendSms(phone, message), demo: false };
  } catch (err) {
    console.error("[sms] send failed (money flow unaffected):", err instanceof Error ? err.message : err);
    return { ok: false, demo: false };
  }
}

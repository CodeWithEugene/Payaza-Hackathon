import "server-only";
import { env } from "@/lib/config/env";

/**
 * SMS sender — Africa's Talking when configured; Demo Mode logs + outbox.
 * Kenyan personas trust SMS receipts (solution §10.4). Never throws.
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

export async function sendSms(to: string, message: string): Promise<{ ok: boolean; demo: boolean }> {
  smsOutbox().unshift({ to, message, at: new Date().toISOString() });
  if (!env.AFRICASTALKING_USER || !env.AFRICASTALKING_KEY) {
    console.log(`[demo-sms → ${to}] ${message}`);
    return { ok: true, demo: true };
  }
  try {
    const africastalking = (await import("africastalking")).default;
    const at = africastalking.initialize({
      username: env.AFRICASTALKING_USER,
      apiKey: env.AFRICASTALKING_KEY,
    });
    await new Promise<void>((resolve, reject) => {
      at.SMS.send({ to: [to.startsWith("+") ? to : `+${to}`], message, from: "KUSANYA" }, (err: unknown) =>
        err ? reject(err) : resolve(),
      );
    });
    return { ok: true, demo: false };
  } catch (err) {
    console.error("[sms] send failed (money flow unaffected):", err);
    return { ok: false, demo: false };
  }
}

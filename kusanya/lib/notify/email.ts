import "server-only";
import { env } from "@/lib/config/env";

/**
 * Email sender — Resend when configured; Demo Mode logs to console and
 * records into the demo outbox (visible in /app/settings → Demo panel).
 * Never throws: notification failure must not fail money flows.
 */

let resendInstance: import("resend").Resend | null = null;
async function getResend() {
  if (!env.RESEND_API_KEY) return null;
  if (!resendInstance) {
    const { Resend } = await import("resend");
    resendInstance = new Resend(env.RESEND_API_KEY);
  }
  return resendInstance;
}

export interface OutboxEntry {
  to: string;
  subject: string;
  tag: string;
  at: string;
}

const globalOutbox = globalThis as unknown as { _kusanyaOutbox?: OutboxEntry[] };
export function demoOutbox(): OutboxEntry[] {
  globalOutbox._kusanyaOutbox ??= [];
  return globalOutbox._kusanyaOutbox;
}

export async function sendEmail(msg: {
  to: string;
  subject: string;
  html: string;
  tag: string;
}): Promise<{ ok: boolean; demo: boolean }> {
  demoOutbox().unshift({ to: msg.to, subject: msg.subject, tag: msg.tag, at: new Date().toISOString() });
  const resend = await getResend();
  if (!resend) {
    console.log(`[demo-email → ${msg.to}] ${msg.subject}`);
    return { ok: true, demo: true };
  }
  try {
    await resend.emails.send({
      from: env.IS_PROD ? "Kusanya <invoices@kusanya.app>" : "Kusanya <onboarding@resend.dev>",
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
    });
    return { ok: true, demo: false };
  } catch (err) {
    console.error("[email] send failed (money flow unaffected):", err);
    return { ok: false, demo: false };
  }
}

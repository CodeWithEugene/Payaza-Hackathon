import "server-only";
import { env } from "@/lib/config/env";
import { SEED_EMAILS } from "@/lib/notify/seed-emails";

/**
 * Email sender. Provider order: Brevo (transactional API) → Resend → demo
 * outbox only. Every message is also recorded in the in-app demo outbox.
 * Never throws: a notification failure must not fail a money flow.
 *
 * Delivery guard: seeded demo addresses (some are real-looking domains, e.g.
 * ap@globalfoods.com) and reserved test TLDs are NEVER delivered, so demo
 * resets and test runs cannot email strangers. They stay outbox-only.
 */

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const SEND_TIMEOUT_MS = 10_000;
const RESERVED_TLDS = [".demo", ".example", ".test", ".invalid", ".localhost"];

export function isDeliverable(address: string): boolean {
  const email = address.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  if (SEED_EMAILS.has(email)) return false;
  return !RESERVED_TLDS.some((tld) => email.endsWith(tld));
}

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
  if (!isDeliverable(msg.to)) {
    console.log(`[demo-email → ${msg.to}] ${msg.subject}`);
    return { ok: true, demo: true };
  }
  try {
    if (env.BREVO_API_KEY) return { ok: await sendViaBrevo(msg), demo: false };
    const resend = await getResend();
    if (resend) {
      await resend.emails.send({ from: `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM_ADDRESS}>`, to: msg.to, subject: msg.subject, html: msg.html });
      return { ok: true, demo: false };
    }
  } catch (err) {
    console.error("[email] send failed (money flow unaffected):", err instanceof Error ? err.message : err);
    return { ok: false, demo: false };
  }
  console.log(`[demo-email → ${msg.to}] ${msg.subject}`);
  return { ok: true, demo: true };
}

async function sendViaBrevo(msg: { to: string; subject: string; html: string; tag: string }): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(BREVO_URL, {
      method: "POST",
      headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { name: env.EMAIL_FROM_NAME, email: env.EMAIL_FROM_ADDRESS },
        to: [{ email: msg.to }],
        subject: msg.subject,
        htmlContent: msg.html,
        tags: [`kusanya-${msg.tag}`],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("[email] brevo", res.status, (await res.text()).slice(0, 200));
      return false;
    }
    return true;
  } finally {
    clearTimeout(timer);
  }
}

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/config/env";

/**
 * Webhook signature verification (research §4.5, guides_webhooks.md):
 *   x-payaza-signature = base64( HMAC-SHA512( rawBody, PAYAZA_SECRET_KEY ) )
 *
 * CRITICAL: hash the EXACT raw request bytes (text), never re-serialized JSON.
 * Timing-safe compare. Invalid signatures are rejected AND audit-logged
 * (route handler responsibility).
 */
export function verifyPayazaSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader || !env.PAYAZA_SECRET_KEY) return false;
  const expected = createHmac("sha512", env.PAYAZA_SECRET_KEY)
    .update(rawBody, "utf8")
    .digest("base64");
  return safeEqual(expected, signatureHeader.trim());
}

/**
 * Demo Mode replay uses a separate shared secret (demo fixtures are unsigned);
 * the replay endpoint enforces DEMO_MODE=true + this header before bypassing
 * signature checks (build.md §11 /api/demo/replay).
 */
export const DEMO_REPLAY_HEADER = "x-kusanya-demo-replay";

export function isDemoReplay(
  headers: Headers,
  demoMode: boolean,
): boolean {
  return demoMode && headers.get(DEMO_REPLAY_HEADER) === "true";
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Compare against self to keep timing uniform, then fail.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

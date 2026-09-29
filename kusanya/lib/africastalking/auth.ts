import "server-only";
import { timingSafeEqual } from "node:crypto";
import { atConfigured, callbackToken } from "./client";

/** Constant-time check of the ?token= on Africa's Talking callback URLs. */
export function validCallbackToken(req: Request): boolean {
  if (!atConfigured()) return false;
  const presented = new URL(req.url).searchParams.get("token") ?? "";
  const expected = callbackToken();
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

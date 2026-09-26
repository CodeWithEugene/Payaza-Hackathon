import "server-only";
import { env } from "@/lib/config/env";

/**
 * Payaza auth headers (research §4.1 — the #1 integration gotcha):
 *  - Authorization: `Payaza <base64(PUBLIC_KEY)>` — NOT Bearer.
 *  - X-TenantID: test | live on EVERY call.
 *  - X-ProductID: app ONLY for /subsidiary/* collection endpoints.
 */

let cachedAuth: string | null = null;

export function authorizationHeader(): string {
  if (!cachedAuth) {
    if (!env.PAYAZA_PUBLIC_KEY) {
      throw new Error(
        "PAYAZA_PUBLIC_KEY missing — cannot call live APIs (Demo Mode should intercept first)",
      );
    }
    cachedAuth = `Payaza ${Buffer.from(env.PAYAZA_PUBLIC_KEY).toString("base64")}`;
  }
  return cachedAuth;
}

export function payazaHeaders(opts: { productId?: boolean } = {}): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: authorizationHeader(),
    "X-TenantID": env.PAYAZA_TENANT,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (opts.productId) headers["X-ProductID"] = env.PAYAZA_PRODUCT_ID;
  return headers;
}

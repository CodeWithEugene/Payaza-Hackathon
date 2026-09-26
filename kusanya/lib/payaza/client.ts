import "server-only";
import { z } from "zod";
import { env } from "@/lib/config/env";
import { payazaHeaders } from "./headers";

/**
 * payazaFetch — the ONLY function that talks to api.payaza.africa
 * (build.md §6.1). Rules:
 *  - Authorization: Payaza <base64> + X-TenantID (+X-ProductID for /subsidiary/*)
 *  - Zod-parse every response (typed end-to-end)
 *  - 15s timeout; GET retried 2× (500ms backoff); POST NEVER auto-retried
 *    (Payaza doesn't retry either — app-level retry = NEW reference)
 *  - Structured log: path, status, response_code, reference — never keys/PAN
 *  - DEMO_MODE: callers intercept BEFORE reaching here (endpoints.ts routes
 *    to demo-payloads fixtures); if we get here without keys, fail loudly.
 */

export class PayazaError extends Error {
  constructor(
    readonly path: string,
    readonly httpStatus: number,
    readonly responseCode: string | undefined,
    readonly responseMessage: string | undefined,
    readonly bodySnippet?: string,
  ) {
    super(
      `Payaza ${path} → HTTP ${httpStatus}${responseCode ? ` code=${responseCode}` : ""}${responseMessage ? `: ${responseMessage}` : ""}`,
    );
    this.name = "PayazaError";
  }
}

interface PayazaFetchOpts {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Force X-ProductID header (default: auto for /subsidiary/*). */
  productId?: boolean;
  timeoutMs?: number;
}

export async function payazaFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  opts: PayazaFetchOpts = {},
): Promise<T> {
  const method = opts.method ?? "GET";
  const needsProductId =
    opts.productId ?? path.startsWith("/subsidiary/");
  const url = new URL(path, env.PAYAZA_BASE_URL);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }

  const maxAttempts = method === "GET" ? 3 : 1; // POSTs never auto-retry
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      opts.timeoutMs ?? 15_000,
    );
    try {
      const res = await fetch(url, {
        method,
        headers: payazaHeaders({ productId: needsProductId }),
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
        cache: "no-store",
      });
      const text = await res.text();
      let json: unknown;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        throw new PayazaError(path, res.status, undefined, "non-JSON body", text.slice(0, 200));
      }
      logPayazaCall(path, method, res.status, json);
      if (!res.ok) {
        throw new PayazaError(
          path,
          res.status,
          extractCode(json),
          extractMessage(json),
          text.slice(0, 300),
        );
      }
      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        throw new PayazaError(
          path,
          res.status,
          undefined,
          "response failed schema validation",
          JSON.stringify(parsed.error.issues).slice(0, 300),
        );
      }
      return parsed.data;
    } catch (err) {
      lastErr = err;
      const retriable =
        method === "GET" &&
        attempt < maxAttempts &&
        (err instanceof PayazaError ? err.httpStatus >= 500 : true); // abort/network
      if (!retriable) break;
      await sleep(500 * attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new PayazaError(path, 0, undefined, "unknown fetch failure");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractCode(json: unknown): string | undefined {
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    for (const k of ["response_code", "code", "resp_code"]) {
      const v = o[k];
      if (typeof v === "string" || typeof v === "number") return String(v);
    }
  }
  return undefined;
}

function extractMessage(json: unknown): string | undefined {
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    for (const k of ["response_message", "message", "error"]) {
      if (typeof o[k] === "string") return o[k] as string;
    }
  }
  return undefined;
}

/** Structured call log — never keys, never PAN (security §12). Axiom drain in v1. */
function logPayazaCall(
  path: string,
  method: string,
  status: number,
  json: unknown,
) {
  if (env.IS_PROD) {
    console.log(
      JSON.stringify({
        log: "payaza_call",
        path,
        method,
        status,
        code: extractCode(json),
        ts: new Date().toISOString(),
      }),
    );
  }
}

/** Guard for endpoints that must never run in Demo Mode by accident. */
export function assertLiveMode(op: string): void {
  if (env.DEMO_MODE) {
    throw new Error(
      `${op} requires live Payaza credentials — app is in Demo Mode (set PAYAZA_PUBLIC_KEY)`,
    );
  }
}

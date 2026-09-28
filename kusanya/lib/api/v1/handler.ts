import "server-only";
import type { ZodType } from "zod";
import { env } from "@/lib/config/env";
import { clientKey, createRateLimiter } from "@/lib/api/rate-limit";
import { authenticateApiKey } from "@/lib/services/api-keys";
import { bearerToken } from "./keys";
import { ApiError, fail, toErrorResponse, validationError } from "./envelope";
import { RATE_LIMITS } from "./limits";

/**
 * Route wrapper for the public API v1: bearer-key auth, rate limits, JSON
 * parsing, and error → envelope mapping. Handlers only see a business-scoped
 * context; they never touch the raw key.
 */

const perKey = createRateLimiter(RATE_LIMITS.perKey);
const extractPerKey = createRateLimiter(RATE_LIMITS.extractPerKey);
const perIp = createRateLimiter(RATE_LIMITS.perIp);

export interface ApiContext {
  req: Request;
  businessId: string;
  keyId: string;
  /** Audit-log actor for API-originated mutations. */
  actorId: string;
  appUrl: string;
}

type Limiter = "default" | "extract";

function retryAfter(windowMs: number): Record<string, string> {
  return { "Retry-After": String(Math.ceil(windowMs / 1000)) };
}

export async function authenticateRequest(req: Request, limiter: Limiter = "default"): Promise<ApiContext | Response> {
  if (!perIp(`v1:${clientKey(req.headers)}`)) {
    return fail("rate_limited", "Too many requests from this address. Slow down and retry.", {
      headers: retryAfter(RATE_LIMITS.perIp.windowMs),
    });
  }

  const secret = bearerToken(req.headers.get("authorization"));
  if (!secret) {
    return fail("unauthorized", "Missing API key. Send it as: Authorization: Bearer <key>.", {
      headers: { "WWW-Authenticate": 'Bearer realm="kusanya"' },
    });
  }

  const auth = await authenticateApiKey(secret);
  if (!auth.ok) {
    return auth.reason === "revoked"
      ? fail("key_revoked", "This API key has been revoked. Create a new key in the dashboard.")
      : fail("unauthorized", "Invalid API key.", { headers: { "WWW-Authenticate": 'Bearer realm="kusanya"' } });
  }

  const { keyId, businessId } = auth.key;
  if (!perKey(keyId) || (limiter === "extract" && !extractPerKey(keyId))) {
    const windowMs = limiter === "extract" ? RATE_LIMITS.extractPerKey.windowMs : RATE_LIMITS.perKey.windowMs;
    return fail("rate_limited", "Rate limit exceeded for this API key. Retry after the window resets.", {
      headers: retryAfter(windowMs),
    });
  }

  return { req, businessId, keyId, actorId: `api:${keyId}`, appUrl: env.NEXT_PUBLIC_APP_URL };
}

/** Parse + validate a JSON body; throws ApiError (400) on bad JSON or schema. */
export async function parseJsonBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError("invalid_json", "The request body must be valid JSON.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw validationError(parsed.error);
  return parsed.data;
}

export function parseQuery<T>(req: Request, schema: ZodType<T>): T {
  const parsed = schema.safeParse(Object.fromEntries(new URL(req.url).searchParams.entries()));
  if (!parsed.success) throw validationError(parsed.error, "Query parameter validation failed.");
  return parsed.data;
}

interface RouteArgs<P> {
  params: Promise<P>;
}

/**
 * Wrap a v1 handler. Known errors map to their documented status; anything
 * else is logged server-side (no key material) and returned as a generic 500.
 */
export function apiRoute<P = Record<string, never>>(
  handler: (ctx: ApiContext, params: P) => Promise<Response>,
  opts: { limiter?: Limiter } = {},
) {
  return async (req: Request, route: RouteArgs<P>): Promise<Response> => {
    const ctx = await authenticateRequest(req, opts.limiter).catch((e: unknown) => {
      console.error("[api/v1] auth failure:", e instanceof Error ? e.message : e);
      return fail("internal_error", "Something went wrong on our side. Please try again.");
    });
    if (ctx instanceof Response) return ctx;
    try {
      const params = await route.params;
      return await handler(ctx, params);
    } catch (e) {
      const response = toErrorResponse(e);
      if (response.status >= 500) {
        console.error(`[api/v1] ${req.method} ${new URL(req.url).pathname} failed (key ${ctx.keyId}):`, e);
      }
      return response;
    }
  };
}

import "server-only";
import { createHash } from "node:crypto";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { env } from "@/lib/config/env";

/**
 * Jev client singleton (build.md §7). Server-only. All questions go through
 * askSystemOne() which adds:
 *  - 4s hard timeout guard (spec) → caller fallbacks, never a hung request
 *  - 24h response cache keyed by hash(state) — same source text never re-infers
 *  - DEMO_MODE: throws JevUnavailable so callers take the deterministic
 *    rule-based fallback (demo judgments are labeled as such in UI + audit).
 */

const client = env.JEV_CONFIGURED
  ? new TypeSafeClient({
      apiKey: env.TYPESAFE_API_KEY,
      defaultModel: env.TYPESAFE_MODEL || "jev-latest",
      timeout: 4_000,
      retry: { maxRetries: 1 },
      logLevel: env.IS_PROD ? "warn" : "error",
    })
  : null;

export class JevUnavailable extends Error {
  constructor(reason: string) {
    super(`Jev unavailable: ${reason}`);
    this.name = "JevUnavailable";
  }
}

interface CacheEntry {
  at: number;
  result: unknown;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function jevEnabled(): boolean {
  return client !== null && !env.DEMO_MODE;
}

export type Questions = Parameters<TypeSafeClient["systemOne"]>[0]["questions"];

export async function askSystemOne<Q extends Questions>(
  questions: Q,
  state: unknown,
  opts: { cacheKey?: string; timeoutMs?: number } = {},
): Promise<{ model: string; answers: { [K in keyof Q]: unknown }; usage: { input_tokens: number; output_tokens: number } }> {
  if (!client || env.DEMO_MODE) {
    throw new JevUnavailable(env.DEMO_MODE ? "demo mode" : "no TYPESAFE_API_KEY");
  }
  const key =
    opts.cacheKey ??
    createHash("sha256")
      .update(JSON.stringify({ state, questions }))
      .digest("hex");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.result as never;
  }
  const result = await client.systemOne(
    { state: state as never, questions },
    { timeout: opts.timeoutMs ?? 4_000 },
  );
  cache.set(key, { at: Date.now(), result });
  return result as never;
}

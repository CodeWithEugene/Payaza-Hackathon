/**
 * Fixed-window, in-memory rate limiter for public endpoints that spend money
 * per call (e.g. /api/help → Jev). Best effort on serverless: each warm
 * instance keeps its own window, which still caps a single abusive client.
 */

interface Window {
  start: number;
  count: number;
}

const MAX_TRACKED_KEYS = 5_000;

export function createRateLimiter(opts: { limit: number; windowMs: number }) {
  const windows = new Map<string, Window>();

  return function allow(key: string, now: number = Date.now()): boolean {
    const current = windows.get(key);
    if (!current || now - current.start >= opts.windowMs) {
      if (windows.size >= MAX_TRACKED_KEYS) windows.clear(); // bounded memory
      windows.set(key, { start: now, count: 1 });
      return true;
    }
    if (current.count >= opts.limit) return false;
    windows.set(key, { start: current.start, count: current.count + 1 });
    return true;
  };
}

/** Client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientKey(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}

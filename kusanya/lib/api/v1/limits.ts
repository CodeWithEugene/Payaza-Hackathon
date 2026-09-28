/** Public API v1 rate limits (fixed one-minute windows). Shared by the
 * handler and the docs/OpenAPI so the numbers can never drift. */
export const RATE_LIMITS = {
  perKey: { limit: 120, windowMs: 60_000 },
  extractPerKey: { limit: 20, windowMs: 60_000 },
  perIp: { limit: 300, windowMs: 60_000 },
} as const;

export const RATE_LIMITS_DOC =
  `${RATE_LIMITS.perKey.limit} requests per minute per API key, ` +
  `of which at most ${RATE_LIMITS.extractPerKey.limit} per minute may be extraction calls, ` +
  `and ${RATE_LIMITS.perIp.limit} requests per minute per IP address. ` +
  "A 429 response carries a Retry-After header in seconds.";

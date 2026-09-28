import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * API key primitives (pure, no DB). Format:
 *
 *   ksn_test_<40 base62 chars>
 *
 * "test" because every Kusanya rail currently runs on the Payaza sandbox.
 * The first KEY_PREFIX_LENGTH characters are stored in clear as a lookup
 * handle (and shown in the UI); the full secret is only ever stored as a
 * SHA-256 hex digest. Keys carry ~238 bits of entropy, so a fast hash is the
 * right tool (no password-style stretching needed).
 */

export const KEY_MODE = "test" as const;
export const KEY_PREFIX = `ksn_${KEY_MODE}_`;
const RANDOM_LENGTH = 40;
/** Visible handle: "ksn_test_" + 8 random chars. */
export const KEY_PREFIX_LENGTH = KEY_PREFIX.length + 8;

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const KEY_PATTERN = new RegExp(`^ksn_(test|live)_[0-9A-Za-z]{${RANDOM_LENGTH}}$`);

/** Unbiased base62 string from CSPRNG bytes (rejection sampling). */
function randomBase62(length: number): string {
  let out = "";
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte < 248) out += BASE62[byte % 62]; // 248 = 62 * 4, drop the biased tail
      if (out.length === length) break;
    }
  }
  return out;
}

export function hashApiKey(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function keyPrefixOf(secret: string): string {
  return secret.slice(0, KEY_PREFIX_LENGTH);
}

export function isWellFormedKey(secret: string): boolean {
  return KEY_PATTERN.test(secret);
}

export interface GeneratedKey {
  /** Full plaintext secret: return to the caller once, never persist. */
  secret: string;
  prefix: string;
  hash: string;
}

export function generateApiKey(): GeneratedKey {
  const secret = `${KEY_PREFIX}${randomBase62(RANDOM_LENGTH)}`;
  return { secret, prefix: keyPrefixOf(secret), hash: hashApiKey(secret) };
}

/** Constant-time comparison of two hex digests of equal length. */
export function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export interface StoredKeyLike {
  id: string;
  businessId: string;
  keyHash: string;
  revokedAt: Date | null;
}

export type KeyVerification<T extends StoredKeyLike> =
  | { ok: true; key: T }
  | { ok: false; reason: "malformed" | "unknown" | "revoked" };

/**
 * Match a presented secret against candidate rows (already narrowed by
 * prefix). Every candidate is compared in constant time; revoked keys are
 * recognised (so the caller can say so) but never authenticate.
 */
export function verifyApiKey<T extends StoredKeyLike>(
  secret: string,
  candidates: readonly T[],
): KeyVerification<T> {
  if (!isWellFormedKey(secret)) return { ok: false, reason: "malformed" };
  const presented = hashApiKey(secret);
  let match: T | null = null;
  for (const row of candidates) {
    if (safeEqualHex(presented, row.keyHash)) match = row;
  }
  if (!match) return { ok: false, reason: "unknown" };
  if (match.revokedAt) return { ok: false, reason: "revoked" };
  return { ok: true, key: match };
}

/** "Authorization: Bearer <key>" → key, or null when absent/malformed header. */
export function bearerToken(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(headerValue.trim());
  return match?.[1] ?? null;
}

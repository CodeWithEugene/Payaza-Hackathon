import { describe, expect, it } from "vitest";
import {
  KEY_PREFIX,
  KEY_PREFIX_LENGTH,
  bearerToken,
  generateApiKey,
  hashApiKey,
  isWellFormedKey,
  keyPrefixOf,
  safeEqualHex,
  verifyApiKey,
} from "@/lib/api/v1/keys";

function stored(secret: string, overrides: Partial<{ id: string; revokedAt: Date | null }> = {}) {
  return {
    id: overrides.id ?? "key_1",
    businessId: "biz_1",
    keyHash: hashApiKey(secret),
    revokedAt: overrides.revokedAt ?? null,
  };
}

describe("generateApiKey", () => {
  it("produces a ksn_test_ key with 40 base62 characters", () => {
    const { secret } = generateApiKey();
    expect(secret.startsWith(KEY_PREFIX)).toBe(true);
    expect(secret).toMatch(/^ksn_test_[0-9A-Za-z]{40}$/);
    expect(isWellFormedKey(secret)).toBe(true);
  });

  it("stores only the prefix and a sha256 hex hash, never the secret", () => {
    const key = generateApiKey();
    expect(key.prefix).toBe(key.secret.slice(0, KEY_PREFIX_LENGTH));
    expect(key.prefix.length).toBe(KEY_PREFIX_LENGTH);
    expect(key.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(key.hash).toBe(hashApiKey(key.secret));
    expect(key.hash).not.toContain(key.secret);
  });

  it("never repeats across many generations", () => {
    const secrets = new Set(Array.from({ length: 500 }, () => generateApiKey().secret));
    expect(secrets.size).toBe(500);
  });
});

describe("verifyApiKey", () => {
  it("accepts the matching key", () => {
    const { secret } = generateApiKey();
    const result = verifyApiKey(secret, [stored(secret)]);
    expect(result.ok).toBe(true);
    expect(result.ok && result.key.businessId).toBe("biz_1");
  });

  it("rejects a wrong key with the same prefix", () => {
    const { secret } = generateApiKey();
    const forged = `${keyPrefixOf(secret)}${"A".repeat(secret.length - KEY_PREFIX_LENGTH)}`;
    expect(verifyApiKey(forged, [stored(secret)])).toEqual({ ok: false, reason: "unknown" });
  });

  it("rejects a revoked key and says so", () => {
    const { secret } = generateApiKey();
    const result = verifyApiKey(secret, [stored(secret, { revokedAt: new Date() })]);
    expect(result).toEqual({ ok: false, reason: "revoked" });
  });

  it("rejects malformed secrets before any comparison", () => {
    expect(verifyApiKey("sk_live_123", [])).toEqual({ ok: false, reason: "malformed" });
    expect(verifyApiKey("", [])).toEqual({ ok: false, reason: "malformed" });
  });

  it("picks the right row among several candidates", () => {
    const a = generateApiKey().secret;
    const b = generateApiKey().secret;
    const result = verifyApiKey(b, [stored(a, { id: "key_a" }), stored(b, { id: "key_b" })]);
    expect(result.ok && result.key.id).toBe("key_b");
  });
});

describe("safeEqualHex", () => {
  it("compares equal digests and rejects different or mismatched lengths", () => {
    const h = hashApiKey("x");
    expect(safeEqualHex(h, h)).toBe(true);
    expect(safeEqualHex(h, hashApiKey("y"))).toBe(false);
    expect(safeEqualHex(h, h.slice(0, 32))).toBe(false);
    expect(safeEqualHex("", "")).toBe(false);
  });
});

describe("bearerToken", () => {
  it("extracts the token from a Bearer header", () => {
    expect(bearerToken("Bearer ksn_test_abc")).toBe("ksn_test_abc");
    expect(bearerToken("bearer   ksn_test_abc  ")).toBe("ksn_test_abc");
  });

  it("returns null for missing or non-bearer headers", () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("Basic dXNlcjpwYXNz")).toBeNull();
    expect(bearerToken("Bearer")).toBeNull();
    expect(bearerToken("Bearer a b")).toBeNull();
  });
});

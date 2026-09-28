import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, ensureSchema } from "@/lib/db/client";
import { apiKeys, type ApiKey } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { writeAudit } from "@/lib/db/audit";
import {
  generateApiKey,
  isWellFormedKey,
  keyPrefixOf,
  verifyApiKey,
} from "@/lib/api/v1/keys";

/**
 * API key lifecycle: create (secret returned once), list, revoke, and
 * authenticate. Every management call is scoped to the caller's business.
 */

export const MAX_ACTIVE_KEYS = 10;

/**
 * Migrations are applied by signup / demo reset / `pnpm db:migrate`. A
 * deployment upgraded in place may receive API traffic before either runs,
 * so the first key operation per process applies pending migrations
 * (idempotent: drizzle's migrator no-ops once the journal is applied).
 */
let schemaReady: Promise<void> | null = null;
function ready(): Promise<void> {
  schemaReady ??= ensureSchema().catch((e) => {
    schemaReady = null;
    throw e;
  });
  return schemaReady;
}

/** Public shape of a key row: never includes the hash. */
export interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

function summarize(row: ApiKey): ApiKeySummary {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}

export async function listApiKeys(businessId: string): Promise<ApiKeySummary[]> {
  await ready();
  const rows = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.businessId, businessId))
    .orderBy(desc(apiKeys.createdAt));
  return rows.map(summarize);
}

export async function createApiKey(input: {
  businessId: string;
  actorId: string;
  name: string;
}): Promise<{ key: ApiKeySummary; secret: string }> {
  await ready();
  const active = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(and(eq(apiKeys.businessId, input.businessId), isNull(apiKeys.revokedAt)));
  if (active.length >= MAX_ACTIVE_KEYS) {
    throw new Error(`You can have at most ${MAX_ACTIVE_KEYS} active keys. Revoke one first.`);
  }

  const generated = generateApiKey();
  const [row] = await db
    .insert(apiKeys)
    .values({
      id: newId("key"),
      businessId: input.businessId,
      name: input.name,
      prefix: generated.prefix,
      keyHash: generated.hash,
    })
    .returning();

  await writeAudit({
    actor: input.actorId,
    action: "api_key.created",
    entityType: "api_keys",
    entityId: row!.id,
    after: { name: input.name, prefix: generated.prefix },
  });
  return { key: summarize(row!), secret: generated.secret };
}

export async function revokeApiKey(input: {
  businessId: string;
  actorId: string;
  keyId: string;
}): Promise<void> {
  await ready();
  const [row] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiKeys.id, input.keyId),
        eq(apiKeys.businessId, input.businessId),
        isNull(apiKeys.revokedAt),
      ),
    )
    .returning();
  if (!row) throw new Error("key not found or already revoked");
  await writeAudit({
    actor: input.actorId,
    action: "api_key.revoked",
    entityType: "api_keys",
    entityId: row.id,
    after: { prefix: row.prefix },
  });
}

export type AuthenticatedKey = { keyId: string; businessId: string };

/**
 * Resolve a presented secret to its business. Candidates are narrowed by the
 * clear prefix, then compared by hash in constant time (lib/api/v1/keys).
 */
export async function authenticateApiKey(
  secret: string,
): Promise<{ ok: true; key: AuthenticatedKey } | { ok: false; reason: "malformed" | "unknown" | "revoked" }> {
  if (!isWellFormedKey(secret)) return { ok: false, reason: "malformed" };
  await ready();
  const candidates = await db
    .select({
      id: apiKeys.id,
      businessId: apiKeys.businessId,
      keyHash: apiKeys.keyHash,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.prefix, keyPrefixOf(secret)))
    .limit(5);
  const result = verifyApiKey(secret, candidates);
  if (!result.ok) return result;

  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, result.key.id));
  return { ok: true, key: { keyId: result.key.id, businessId: result.key.businessId } };
}

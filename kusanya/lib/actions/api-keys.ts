"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { businesses } from "@/lib/db/schema";
import { createApiKey, revokeApiKey, type ApiKeySummary } from "@/lib/services/api-keys";
import type { ActionResult } from "./auth";

/**
 * Developer API key management (dashboard → Developers). Session + business
 * scoped: the business id always comes from the signed-in user, never from
 * the client.
 */

async function sessionContext() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const rows = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.userId, session.user.id))
    .limit(1);
  if (!rows[0]) return null;
  return { userId: session.user.id, businessId: rows[0].id };
}

const nameSchema = z
  .string()
  .trim()
  .min(2, "Give the key a name of at least 2 characters.")
  .max(80, "Keep the key name under 80 characters.");

const keyIdSchema = z.string().regex(/^key_[0-9a-z]{26}$/, "Unknown key.");

export async function createApiKeyAction(
  name: string,
): Promise<ActionResult<{ key: ApiKeySummary; secret: string }>> {
  const ctx = await sessionContext();
  if (!ctx) return { ok: false, error: "Sign in to manage API keys." };
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the key name." };
  try {
    const created = await createApiKey({ businessId: ctx.businessId, actorId: ctx.userId, name: parsed.data });
    revalidatePath("/app/developers");
    return { ok: true, data: created };
  } catch (e) {
    const message = e instanceof Error && /at most/.test(e.message) ? e.message : "Could not create the key. Try again.";
    return { ok: false, error: message };
  }
}

export async function revokeApiKeyAction(keyId: string): Promise<ActionResult> {
  const ctx = await sessionContext();
  if (!ctx) return { ok: false, error: "Sign in to manage API keys." };
  const parsed = keyIdSchema.safeParse(keyId);
  if (!parsed.success) return { ok: false, error: "Unknown key." };
  try {
    await revokeApiKey({ businessId: ctx.businessId, actorId: ctx.userId, keyId: parsed.data });
    revalidatePath("/app/developers");
    return { ok: true };
  } catch {
    return { ok: false, error: "That key was not found or is already revoked." };
  }
}

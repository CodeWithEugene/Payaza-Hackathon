import "server-only";
import { db, type Db } from "@/lib/db/client";
import { auditLog } from "@/lib/db/schema";
import { newId } from "@/lib/ids";

/**
 * Append-only audit trail (build.md §5: no UPDATE/DELETE paths exist).
 * Every AI judgment AND every money action lands here.
 */
export async function writeAudit(
  entry: {
    actor: string; // user id | "system" | "jev" | "webhook"
    action: string; // e.g. "invoice.risk_assessed", "payout.initiated"
    entityType: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
    aiRef?: string; // ai_extractions.id or risk_assessments.id
  },
  target: Db = db,
): Promise<string> {
  const id = newId("aud");
  await target.insert(auditLog).values({
    id,
    actor: entry.actor,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    before: entry.before ?? null,
    after: entry.after ?? null,
    aiRef: entry.aiRef ?? null,
  });
  return id;
}

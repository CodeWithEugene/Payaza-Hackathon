import "server-only";
import { createHash } from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  payouts,
  transactions,
  webhookEvents,
  type Transaction,
} from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { verifyPayazaSignature, isDemoReplay } from "@/lib/payaza/webhook-verify";
import {
  collectionWebhookSchema,
  transferWebhookSchema,
  type CollectionWebhook,
  type TransferWebhook,
} from "@/lib/payaza/types";
import {
  collectionWebhookToTxnStatus,
  transferWebhookToTxnStatus,
} from "@/lib/payaza/state-machine";
import { applyCollectionResult } from "./collections";
import { applyPayoutResult } from "./payouts";
import { writeAudit } from "@/lib/db/audit";
import { env } from "@/lib/config/env";

/**
 * Webhook intake (build.md §6.3 — the money spine's source of truth):
 *   raw bytes → HMAC-SHA512 verify → zod parse → dedupe (unique key) →
 *   route to the SINGLE completion paths (applyCollectionResult /
 *   applyPayoutResult) → mark processed. Fast 200 always; processing is
 *   in-request but bounded (Payaza does NOT retry — we own idempotency).
 */

export interface ReceiveResult {
  outcome: "processed" | "duplicate" | "rejected_signature" | "unparseable" | "unmatched";
  eventId?: string;
  detail?: string;
}

export async function receiveWebhook(opts: {
  rawBody: string;
  signature: string | null;
  headers?: Headers;
}): Promise<ReceiveResult> {
  const demoReplay = opts.headers ? isDemoReplay(opts.headers, env.DEMO_MODE) : false;
  const signatureValid = demoReplay ? false : verifyPayazaSignature(opts.rawBody, opts.signature);

  if (!signatureValid && !demoReplay) {
    await writeAudit({
      actor: "webhook",
      action: "webhook.rejected_signature",
      entityType: "webhook_events",
      entityId: "unknown",
      after: { bodyChars: opts.rawBody.length, ip: "see-proxy" },
    });
    return { outcome: "rejected_signature" };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(opts.rawBody);
  } catch {
    return { outcome: "unparseable" };
  }
  const result = await processWebhookPayload(payload, { signatureValid, demoReplay });
  if (result.outcome === "unparseable" && signatureValid) {
    await keepUnparsedWebhook(payload, result.detail);
  }
  return result;
}

/**
 * A SIGNED webhook we could not parse means Payaza's real shape differs from
 * our schema. Keep the raw event for replay once the schema is fixed, and log
 * its shape (keys, types, status-ish values only; no names/numbers).
 */
async function keepUnparsedWebhook(payload: unknown, detail: string | undefined): Promise<void> {
  const shape = describeShape(payload);
  console.warn("[webhook] signed but unparseable", JSON.stringify({ shape, detail }).slice(0, 1800));
  try {
    const digest = createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 32);
    await db
      .insert(webhookEvents)
      .values({
        id: newId("wev"),
        eventKind: "unparsed",
        transactionReference: pickString(payload, "transaction_reference") ?? "unknown",
        signatureValid: true,
        dedupeKey: `unparsed:${digest}`,
        payload: (payload && typeof payload === "object" ? payload : { value: payload }) as Record<string, unknown>,
        processed: false,
        error: (detail ?? "unparseable").slice(0, 400),
      })
      .onConflictDoNothing();
  } catch (err) {
    console.error("[webhook] could not store unparsed event", err);
  }
}

const SHAPE_VALUE_KEYS = /status|channel|currency|type|event|code|validation|kind/i;

function describeShape(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) return depth > 2 ? "array" : [describeShape(value[0], depth + 1)];
  if (!value || typeof value !== "object") return typeof value;
  if (depth > 2) return "object";
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [
      k,
      typeof v === "string" && SHAPE_VALUE_KEYS.test(k) ? `string:${v.slice(0, 40)}` : describeShape(v, depth + 1),
    ]),
  );
}

function pickString(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object") return null;
  const v = (payload as Record<string, unknown>)[key];
  return typeof v === "string" ? v.slice(0, 64) : null;
}

/** Shared processor — also used by scripts/replay-webhook.ts and demo replay route. */
export async function processWebhookPayload(
  payload: unknown,
  opts: { signatureValid: boolean; demoReplay?: boolean },
): Promise<ReceiveResult> {
  const kind = classify(payload);
  if (!kind) return { outcome: "unparseable", detail: "neither collection nor transfer shape" };

  const parsed =
    kind === "collection"
      ? collectionWebhookSchema.safeParse(payload)
      : transferWebhookSchema.safeParse(payload);
  if (!parsed.success) {
    return { outcome: "unparseable", detail: JSON.stringify(parsed.error.issues).slice(0, 200) };
  }

  const data = parsed.data as CollectionWebhook | TransferWebhook;
  const statusToken =
    kind === "collection"
      ? (data as CollectionWebhook).transaction_status
      : (data as TransferWebhook).transaction_status;
  const dedupeKey = `${opts.demoReplay ? "demo:" : ""}${kind}:${data.transaction_reference}:${statusToken}`;

  const eventId = newId("wev");
  const inserted = await db
    .insert(webhookEvents)
    .values({
      id: eventId,
      eventKind: kind,
      transactionReference: data.transaction_reference,
      signatureValid: opts.signatureValid,
      dedupeKey,
      payload: data as unknown as Record<string, unknown>,
      processed: false,
    })
    .onConflictDoNothing()
    .returning();

  if (inserted.length === 0) {
    return { outcome: "duplicate", detail: dedupeKey }; // idempotent ack
  }

  try {
    const result =
      kind === "collection"
        ? await handleCollectionEvent(data as CollectionWebhook)
        : await handleTransferEvent(data as TransferWebhook);
    await db.update(webhookEvents).set({ processed: true, error: null }).where(eq(webhookEvents.id, eventId));
    return { outcome: result.matched ? "processed" : "unmatched", eventId, detail: result.detail };
  } catch (err) {
    const msg = String(err).slice(0, 400);
    await db.update(webhookEvents).set({ error: msg }).where(eq(webhookEvents.id, eventId));
    await writeAudit({ actor: "webhook", action: "webhook.process_failed", entityType: "webhook_events", entityId: eventId, after: { error: msg } });
    return { outcome: "unmatched", eventId, detail: msg };
  }
}

function classify(payload: unknown): "collection" | "transfer" | null {
  if (!payload || typeof payload !== "object") return null;
  const o = payload as Record<string, unknown>;
  if ("received_from" in o || "amount_validation" in o || "request_amount" in o) return "collection";
  if ("sent_to" in o || o.transaction_type === "DEBIT" || String(o.transaction_status ?? "").startsWith("NIP_")) return "transfer";
  return null;
}

// ------------------------------------------------------------- collection ---

async function handleCollectionEvent(
  data: CollectionWebhook,
): Promise<{ matched: boolean; detail?: string }> {
  const [txn] = await findCollectionTxn(data.merchant_reference, data.transaction_reference);
  if (!txn) {
    return { matched: false, detail: `no txn for ${data.merchant_reference ?? data.transaction_reference}` };
  }
  await applyCollectionResult({
    txn,
    status: collectionWebhookToTxnStatus(data.transaction_status),
    amountReceivedMajor: data.amount_received,
    feeMajor: data.transaction_fee,
    amountValidation: data.amount_validation ?? "EXACT",
    payerName: data.received_from?.account_name ?? null,
    payerAccount: data.received_from?.account_number ?? null,
    payazaStatusRaw: `${data.transaction_status}:${data.status_reason ?? ""}`,
    channelOverride: channelFromWebhook(data.channel),
    occurredAt: data.current_status_date ? new Date(data.current_status_date.replace(" ", "T") + "Z") : new Date(),
    payload: data,
    source: "webhook",
  });
  return { matched: true };
}

async function findCollectionTxn(
  merchantReference: string | null | undefined,
  payazaReference: string | null | undefined,
): Promise<[Transaction | undefined]> {
  if (merchantReference) {
    const rows = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.merchantReference, merchantReference), eq(transactions.kind, "collection")))
      .limit(1);
    if (rows[0]) return [rows[0]];
  }
  if (payazaReference) {
    const rows = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.payazaReference, payazaReference), eq(transactions.kind, "collection")))
      .limit(1);
    if (rows[0]) return [rows[0]];
  }
  return [undefined];
}

function channelFromWebhook(channel: string | null | undefined): Transaction["channel"] | null {
  const c = (channel ?? "").toLowerCase();
  if (c.includes("kenya_collections") || c.includes("momo")) return "momo_ke";
  if (c.includes("apple")) return "apple_pay";
  if (c.includes("google")) return "google_pay";
  if (c.includes("link")) return "payment_link";
  if (c.includes("card")) return "card";
  return null;
}

// --------------------------------------------------------------- transfer ---

async function handleTransferEvent(
  data: TransferWebhook,
): Promise<{ matched: boolean; detail?: string }> {
  // Match by (1) our merchant reference echoed in narration, or
  // (2) Payaza reference stored at initiate, or (3) PTSA reference equality.
  const ourRef = extractOurReference(data.narration);
  const candidates = [ourRef, data.transaction_reference].filter(Boolean) as string[];
  let txn: Transaction | undefined;
  for (const ref of candidates) {
    const rows = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.kind, "payout"),
          or(eq(transactions.merchantReference, ref), eq(transactions.payazaReference, ref))!,
        ),
      )
      .limit(1);
    if (rows[0]) {
      txn = rows[0];
      break;
    }
  }
  if (!txn) return { matched: false, detail: `no payout txn for ${candidates.join("|")}` };

  const [payout] = await db.select().from(payouts).where(eq(payouts.transactionId, txn.id)).limit(1);

  await applyPayoutResult({
    txn,
    payout: payout ?? null,
    status: transferWebhookToTxnStatus(data.transaction_status),
    feeMajor: data.transaction_fee ?? null,
    payazaStatusRaw: `${data.transaction_status}:${data.response_code ?? ""}:${data.response_message ?? ""}`.slice(0, 48),
    payload: data,
    source: "webhook",
  });
  return { matched: true };
}

/** narration carries our KSN-… merchant reference verbatim (see payouts.ts). */
function extractOurReference(narration: string | null | undefined): string | null {
  if (!narration) return null;
  const m = narration.match(/KSN-[A-Za-z0-9]+/);
  return m ? m[0] : null;
}

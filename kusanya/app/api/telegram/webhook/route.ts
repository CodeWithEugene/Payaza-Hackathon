import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { db } from "@/lib/db/client";
import { webhookEvents } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { telegramConfigured, webhookSecret } from "@/lib/telegram/client";
import { handleUpdate, type TgUpdate } from "@/lib/telegram/bot";

/**
 * POST /api/telegram/webhook — Telegram Bot API updates.
 *  - authenticated by the secret Telegram echoes in
 *    X-Telegram-Bot-Api-Secret-Token (set in scripts/telegram-setup.ts)
 *  - deduped on update_id (Telegram redelivers on slow/failed responses)
 *  - acks 200 immediately; extraction + Payaza link creation run in after()
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!telegramConfigured()) return new Response("not configured", { status: 404 });
  const presented = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!safeEqual(presented, webhookSecret())) return new Response("forbidden", { status: 401 });

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return new Response("bad request", { status: 400 });
  }
  if (typeof update?.update_id !== "number") return new Response("bad request", { status: 400 });

  const inserted = await db
    .insert(webhookEvents)
    .values({
      id: newId("wev"),
      eventKind: "telegram",
      transactionReference: null,
      signatureValid: true,
      dedupeKey: `telegram:${update.update_id}`,
      payload: { update_id: update.update_id }, // message text is not stored here
      processed: false,
    })
    .onConflictDoNothing()
    .returning();
  if (inserted.length === 0) return Response.json({ ok: true, duplicate: true });

  after(async () => {
    try {
      await handleUpdate(update);
    } catch (err) {
      console.error("[telegram] update failed:", err);
    }
  });
  return Response.json({ ok: true });
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

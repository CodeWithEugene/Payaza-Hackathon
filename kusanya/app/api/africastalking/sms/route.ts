import { after } from "next/server";
import { db } from "@/lib/db/client";
import { webhookEvents } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { validCallbackToken } from "@/lib/africastalking/auth";
import { handleInboundSms } from "@/lib/africastalking/inbound-sms";

/**
 * POST /api/africastalking/sms?token=… — Africa's Talking incoming SMS
 * callback. Form fields: from, to, text, date, id, linkId. Acks at once;
 * the order pipeline (Jev + Payaza) runs in after(). Deduped on AT's id.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!validCallbackToken(req)) return new Response("unauthorized", { status: 401 });
  const form = await req.formData().catch(() => null);
  const from = String(form?.get("from") ?? "").trim();
  const text = String(form?.get("text") ?? "").slice(0, 2_000);
  const id = String(form?.get("id") ?? "").slice(0, 100);
  if (!from) return new Response("bad request", { status: 400 });

  if (id) {
    const inserted = await db
      .insert(webhookEvents)
      .values({
        id: newId("wev"),
        eventKind: "at_sms",
        transactionReference: null,
        signatureValid: true,
        dedupeKey: `at_sms:${id}`,
        payload: { id }, // message text is not stored here
        processed: false,
      })
      .onConflictDoNothing()
      .returning();
    if (inserted.length === 0) return Response.json({ ok: true, duplicate: true });
  }

  after(async () => {
    try {
      await handleInboundSms({ from, text });
    } catch (err) {
      console.error("[sms] inbound failed:", err);
    }
  });
  return Response.json({ ok: true });
}

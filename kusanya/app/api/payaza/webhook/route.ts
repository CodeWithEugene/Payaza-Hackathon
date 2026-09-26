import { receiveWebhook } from "@/lib/services/webhooks";

/**
 * Payaza webhook receiver (build.md §6.3). Rules:
 *  - read RAW text (signature is over exact bytes)
 *  - verify x-payaza-signature (HMAC-SHA512 base64) BEFORE any processing
 *  - dedupe by reference+status; Payaza does NOT retry → we own reconciliation
 *  - always fast 200 for accepted/rejected; 400 only for unparseable bodies
 *
 * Runtime: nodejs (crypto + DB). Never cache.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const result = await receiveWebhook({
    rawBody,
    signature: req.headers.get("x-payaza-signature"),
    headers: req.headers,
  });

  switch (result.outcome) {
    case "processed":
    case "duplicate":
    case "unmatched": // stored for replay/debugging — ack so Payaza moves on
      return Response.json({ received: true, outcome: result.outcome });
    case "rejected_signature":
      return Response.json({ received: false, reason: "invalid signature" }, { status: 401 });
    case "unparseable":
      return Response.json({ received: false, reason: "unparseable body" }, { status: 400 });
  }
}

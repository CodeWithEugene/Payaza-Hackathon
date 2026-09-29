import { validCallbackToken } from "@/lib/africastalking/auth";
import { handleUssd } from "@/lib/ussd/handler";
import { end } from "@/lib/ussd/screens";

/**
 * POST /api/africastalking/ussd?token=… — Africa's Talking USSD callback
 * (*384*11400# on the sandbox). AT posts form fields sessionId, serviceCode,
 * phoneNumber, text; we answer text/plain "CON …" or "END …" synchronously.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const plain = (body: string, status = 200) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function POST(req: Request) {
  if (!validCallbackToken(req)) return plain("END Unauthorized", 401);
  const form = await req.formData().catch(() => null);
  const phoneNumber = String(form?.get("phoneNumber") ?? "").trim();
  const text = String(form?.get("text") ?? "").slice(0, 200);
  if (!phoneNumber) return plain(end("Missing phone number."), 400);
  try {
    return plain(await handleUssd({ phoneNumber, text }));
  } catch (err) {
    console.error("[ussd] failed:", err);
    return plain(end("Sorry, something went wrong. Please dial again."));
  }
}

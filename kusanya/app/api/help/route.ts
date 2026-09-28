import { z } from "zod";
import { err, json } from "@/lib/api/http";
import { clientKey, createRateLimiter } from "@/lib/api/rate-limit";
import { HELP_MESSAGE_MAX } from "@/lib/help/knowledge";
import { routeHelpMessage } from "@/lib/jev/help";

/**
 * POST /api/help — public help assistant router. Returns article IDS only;
 * the client renders the curated answer text (lib/help/knowledge.ts). Public
 * because buyers and visitors have no session, so it is rate limited and
 * input-capped (each call may spend a Jev request).
 */
export const dynamic = "force-dynamic";

const allow = createRateLimiter({ limit: 20, windowMs: 60_000 });

const bodySchema = z.object({
  message: z.string().trim().min(1).max(HELP_MESSAGE_MAX),
  audience: z.enum(["merchant", "buyer", "visitor"]),
});

export async function POST(req: Request) {
  if (!allow(clientKey(req.headers))) {
    return err(429, "You're asking a lot of questions at once. Please wait a minute and try again.");
  }
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return err(400, "We couldn't read that message.");
  }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return err(400, `Please type a question of up to ${HELP_MESSAGE_MAX} characters.`);
  }
  try {
    const routing = await routeHelpMessage(parsed.data.message, parsed.data.audience);
    return json(routing);
  } catch (error) {
    console.error("[help] routing failed:", error);
    return err(500, "The assistant is unavailable right now. Please try again shortly.");
  }
}

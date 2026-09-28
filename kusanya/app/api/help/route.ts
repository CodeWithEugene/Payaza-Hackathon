import { z } from "zod";
import { err, json } from "@/lib/api/http";
import { clientKey, createRateLimiter } from "@/lib/api/rate-limit";
import { HELP_MESSAGE_MAX } from "@/lib/help/knowledge";
import { answerWithLlm, HELP_HISTORY_MAX } from "@/lib/help/llm";
import { routeHelpMessage } from "@/lib/jev/help";

/**
 * POST /api/help — public help assistant. In parallel:
 *  - GLM (OpenRouter) writes a conversational answer grounded ONLY in the
 *    curated knowledge base (lib/help/llm.ts)
 *  - Jev picks the matching/related curated articles for follow-up chips
 * If the LLM is unavailable, the curated article Jev picked is the answer.
 * Public (buyers and visitors have no session), so rate limited and capped.
 */
export const dynamic = "force-dynamic";

const allow = createRateLimiter({ limit: 20, windowMs: 60_000 });

const bodySchema = z.object({
  message: z.string().trim().min(1).max(HELP_MESSAGE_MAX),
  audience: z.enum(["merchant", "buyer", "visitor"]),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(2_000),
      }),
    )
    .max(HELP_HISTORY_MAX)
    .optional()
    .default([]),
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
  const { message, audience, history } = parsed.data;
  try {
    const [answerText, routing] = await Promise.all([
      answerWithLlm(message, audience, history),
      routeHelpMessage(message, audience),
    ]);
    if (answerText) {
      const related = [routing.answerId, ...routing.suggestionIds].filter((id): id is string => Boolean(id));
      return json({
        answerText,
        answerId: null,
        suggestionIds: [...new Set(related)].slice(0, 3),
        source: "llm",
      });
    }
    return json(routing);
  } catch (error) {
    console.error("[help] routing failed:", error);
    return err(500, "The assistant is unavailable right now. Please try again shortly.");
  }
}

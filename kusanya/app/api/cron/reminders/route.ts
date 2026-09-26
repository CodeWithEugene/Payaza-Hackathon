import { env } from "@/lib/config/env";
import { runDueReminders } from "@/lib/services/reminders";

/**
 * GET /api/cron/reminders — hourly (vercel.json). Sends due guardrail-checked
 * template reminders. Protected by CRON_SECRET in production.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (env.CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${env.CRON_SECRET}`) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const result = await runDueReminders();
  return Response.json({ ok: true, ...result });
}

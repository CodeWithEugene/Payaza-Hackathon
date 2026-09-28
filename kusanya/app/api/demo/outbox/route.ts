import { demoOutbox } from "@/lib/notify/email";
import { smsOutbox } from "@/lib/notify/sms";
import { env } from "@/lib/config/env";

/** GET /api/demo/outbox — merged email+SMS console for Demo Mode UI. */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!env.DEMO_TOOLS) return Response.json([], { status: 404 });
  const emails = demoOutbox().map((e) => ({ ...e, kind: "email" as const }));
  const sms = smsOutbox().map((s) => ({
    to: s.to,
    subject: s.message.slice(0, 80),
    tag: "sms",
    at: s.at,
    kind: "sms" as const,
  }));
  return Response.json([...emails, ...sms].slice(0, 40));
}

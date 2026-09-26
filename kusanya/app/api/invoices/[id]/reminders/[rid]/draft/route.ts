import { z } from "zod";
import { handle, err, routeSession } from "@/lib/api/http";
import { draftReminder } from "@/lib/services/reminders";

/** POST — (re)draft a reminder, guardrail-checked. Optional body override. */
export const dynamic = "force-dynamic";

const bodySchema = z.object({ body: z.string().min(1).max(2000).optional() });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; rid: string }> },
) {
  const session = await routeSession(req);
  if (!session) return err(401, "Not signed in.");
  const { rid } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return err(400, "invalid body");

  return handle(async () => {
    const guard = await draftReminder(rid, session.businessId, parsed.data.body);
    return { guardrail: guard };
  });
}

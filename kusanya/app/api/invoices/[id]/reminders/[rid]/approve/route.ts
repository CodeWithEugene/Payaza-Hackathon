import { handle, err, routeSession } from "@/lib/api/http";
import { sendReminder } from "@/lib/services/reminders";

/** POST — merchant approves and sends a drafted reminder (human-in-the-loop). */
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; rid: string }> },
) {
  const session = await routeSession(req);
  if (!session) return err(401, "Not signed in.");
  const { rid } = await params;

  return handle(async () => sendReminder(rid, session.businessId, session.userId));
}

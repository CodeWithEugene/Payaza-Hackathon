import { z } from "zod";
import { handle, err, routeSession } from "@/lib/api/http";
import { confirmPayoutGate } from "@/lib/services/payouts";

/**
 * POST /api/payouts/[id]/confirm — confirmation gate before money moves.
 * Demo Mode: fixed code shown in the dialog. Live: Payaza dashboard PIN is
 * the real control (env-injected); this gate remains as a second factor.
 */
export const dynamic = "force-dynamic";

const bodySchema = z.object({ code: z.string().min(4).max(8) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await routeSession(req);
  if (!session) return err(401, "Not signed in.");
  const { id } = await params;
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return err(400, "invalid JSON");
  }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) return err(400, "Enter the confirmation code.");

  return handle(async () => {
    await confirmPayoutGate(id, session.businessId, parsed.data.code, session.userId);
    return { ok: true };
  });
}

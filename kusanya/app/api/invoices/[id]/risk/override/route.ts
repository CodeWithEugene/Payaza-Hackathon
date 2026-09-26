import { z } from "zod";
import { handle, err, routeSession } from "@/lib/api/http";
import { mustGetInvoice } from "@/lib/services/invoices";
import { overrideRiskDecision } from "@/lib/services/risk";

/**
 * POST /api/invoices/[id]/risk/override — merchant resolves review/hold.
 * Every override is audit-logged with actor + note (trust requirement).
 */
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  to: z.enum(["ready", "review", "cancelled"]),
  note: z.string().min(2).max(500),
});

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
  if (!parsed.success) return err(400, "Add a short note explaining the override (audit requirement).");

  return handle(async () => {
    const inv = await mustGetInvoice(id, session.businessId);
    if (!["review", "on_hold"].includes(inv.status)) {
      throw new Error("Only invoices under review or on hold can be overridden.");
    }
    await overrideRiskDecision(inv.id, inv.status, parsed.data.to, session.userId, parsed.data.note);
    return { ok: true, status: parsed.data.to };
  });
}

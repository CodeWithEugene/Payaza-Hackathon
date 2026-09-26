import { z } from "zod";
import { handleCheckoutCallback } from "@/lib/services/collections";
import { handle, err } from "@/lib/api/http";

/**
 * Checkout SDK client callback — a HINT only (Payaza docs: always verify
 * server-side). We re-query by merchant reference and only then advance the
 * ledger. Public route (called from the buyer's browser) — no session;
 * security comes from server-side verification, not from this endpoint.
 */
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    merchant_reference: z.string().min(6).max(40).optional(),
    transaction_reference: z.string().optional(),
    status: z.union([z.string(), z.boolean(), z.number()]).optional(),
  })
  .passthrough();

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return err(400, "invalid JSON");
  }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) return err(400, "invalid callback payload");
  const ref = parsed.data.merchant_reference ?? parsed.data.transaction_reference;
  if (!ref) return err(400, "missing reference");

  return handle(async () => {
    const result = await handleCheckoutCallback(ref);
    return { ok: result.found && "verified" in result && result.verified === true, ...result };
  });
}

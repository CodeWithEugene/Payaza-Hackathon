import { z } from "zod";
import { handle, err, routeSession } from "@/lib/api/http";
import { extractFromText } from "@/lib/services/extraction";

/**
 * POST /api/invoices/extract — WhatsApp paste / OCR text → Jev extraction
 * (batched single call) → reviewed fields for the wizard. Auth required.
 */
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  text: z.string().min(3).max(20_000),
  ocrText: z.string().max(20_000).nullish(),
  sourceType: z.enum(["snap", "paste", "manual"]).default("paste"),
  photoUrl: z.string().nullish(),
});

export async function POST(req: Request) {
  const session = await routeSession(req);
  if (!session) return err(401, "Sign in to use extraction.");
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return err(400, "invalid JSON");
  }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) return err(400, "Paste the buyer message first (at least a few words).");

  return handle(async () => {
    const { extractionId, result, candidates } = await extractFromText({
      businessId: session.businessId,
      text: parsed.data.text,
      ocrText: parsed.data.ocrText ?? null,
      sourceType: parsed.data.sourceType,
      photoUrl: parsed.data.photoUrl ?? null,
    });

    return {
      extractionId,
      result: {
        buyer: result.buyer,
        buyerCandidateId: result.buyerCandidateId,
        buyerCandidates: candidates,
        items: result.items,
        total: result.total,
        currency: result.currency,
        dueDate: result.dueDate,
        firmOrder: result.firmOrder,
        quality: result.quality,
        model: result.model,
        durationMs: result.durationMs,
      },
    };
  });
}

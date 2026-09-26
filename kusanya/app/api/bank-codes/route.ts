import { handle, err, routeSession } from "@/lib/api/http";
import { bankCodes } from "@/lib/payaza/endpoints";

/** GET /api/bank-codes?currency=KES — bank/momo codes (docs: cache 24h). */
export const dynamic = "force-dynamic";

const cache = new Map<string, { at: number; data: unknown }>();

export async function GET(req: Request) {
  const session = await routeSession(req);
  if (!session) return err(401, "Not signed in.");
  const currency = new URL(req.url).searchParams.get("currency") ?? "KES";
  return handle(async () => {
    const hit = cache.get(currency);
    if (hit && Date.now() - hit.at < 24 * 3600_000) return { currency, data: hit.data, cached: true };
    const resp = await bankCodes(currency);
    cache.set(currency, { at: Date.now(), data: resp.data });
    return { currency, data: resp.data, cached: false };
  });
}

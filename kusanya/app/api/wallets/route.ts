import { handle, err, routeSession } from "@/lib/api/http";
import { getWallets } from "@/lib/services/payouts";

/** GET /api/wallets — Payaza account enquiry (balances + references), 60s cache. */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await routeSession(req);
  if (!session) return err(401, "Not signed in.");
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  return handle(async () => {
    const wallets = await getWallets(session.businessId, force);
    return {
      wallets: wallets.data.map((w) => ({
        currency: w.currency,
        balance: w.accountBalance,
        status: w.status,
        reference: w.payazaAccountReference,
        productCode: w.productCode,
        postNoDebit: w.postNoDebit ?? false,
      })),
    };
  });
}

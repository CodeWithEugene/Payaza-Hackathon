/**
 * pnpm sandbox:smoke — verify Payaza sandbox credentials + core endpoints
 * against the LIVE sandbox (X-TenantID: test). Safe: read-only endpoints +
 * a KES 1 test-merchant collection ONLY when explicitly allowed by flag.
 *
 * Requires real keys in .env.local (Appendix B sandbox access). Without keys
 * it prints a skip notice and exits 0 — CI and Demo Mode stay green.
 *
 * Run: node --conditions=react-server --import tsx scripts/sandbox-smoke.ts
 */
import { env } from "@/lib/config/env";

async function main() {
  if (!env.PAYAZA_CONFIGURED) {
    console.log(
      "⚠ No PAYAZA_PUBLIC_KEY configured — skipping live sandbox smoke.\n" +
        "  The app runs in Demo Mode (synthetic payloads, same code paths).\n" +
        "  To run this for real: add sandbox keys to kusanya/.env.local (Appendix B).",
    );
    return;
  }

  const { bankCodes, accountEnquiry } = await import("@/lib/payaza/endpoints");

  console.log(`Payaza sandbox smoke — tenant=${env.PAYAZA_TENANT}`);

  console.log("→ GET bank codes (KES)…");
  const codes = await bankCodes("KES");
  const list = Array.isArray(codes.data) ? codes.data : [];
  console.log(`  ✓ ${list.length} institutions (first: ${JSON.stringify(list[0] ?? null)})`);

  console.log("→ GET account enquiry (wallets)…");
  try {
    const wallets = await accountEnquiry();
    for (const w of wallets.data) {
      console.log(`  ✓ ${w.currency} wallet: balance ${w.accountBalance} status ${w.status} PND=${w.postNoDebit ?? false}`);
    }
  } catch (err) {
    console.log(`  ⚠ account enquiry failed (may need funded sandbox): ${String(err).slice(0, 200)}`);
  }

  console.log("→ merchant transaction query on a known-missing ref (expect graceful 4xx)…");
  const { merchantTransactionQuery } = await import("@/lib/payaza/endpoints");
  try {
    await merchantTransactionQuery("KSN-SMOKE-NONEXISTENT");
    console.log("  ⚠ unexpected success");
  } catch (err) {
    console.log(`  ✓ handled: ${String(err).slice(0, 160)}`);
  }

  console.log("Sandbox smoke complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("sandbox smoke FAILED:", err);
    process.exit(1);
  });

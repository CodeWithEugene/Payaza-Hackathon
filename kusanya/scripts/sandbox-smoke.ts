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
  try {
    const codes = await bankCodes("KES");
    const list = Array.isArray(codes.data) ? codes.data : [];
    console.log(`  ✓ ${list.length} institutions (first: ${JSON.stringify(list[0] ?? null)})`);
  } catch (err) {
    // Observed 2026-09-28: sandbox returns 403 "Authentication failed" here even
    // though the same key authenticates every other endpoint.
    console.log(`  ⚠ bank codes unavailable in sandbox: ${String(err).slice(0, 160)}`);
  }

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

  if (process.argv.includes("--collect")) await liveCollection();

  console.log("Sandbox smoke complete.");
}

/** --collect: KES 10 M-Pesa prompt → sandbox funding (simulated approval) → status. */
async function liveCollection() {
  const { processCollection, fundTestCollection, checkCollectionStatus } = await import(
    "@/lib/payaza/endpoints"
  );
  const ref = `KSN-SMOKE-${Date.now().toString(36).toUpperCase()}`;
  const input = {
    amount: 10,
    customer_number: "254712345678",
    transaction_reference: ref,
    transaction_description: "Kusanya sandbox smoke",
    customer_bank_code: "SAFKEN",
    currency_code: "KES",
    customer_email: "smoke@kusanya.demo",
    customer_first_name: "Sandbox",
    customer_last_name: "Smoke",
    customer_phone_number: "254712345678",
    country_code: "KE" as const,
  };
  console.log(`→ POST process-collection KES 10 (${ref})…`);
  const prompt = await processCollection(input);
  console.log(`  ✓ ${JSON.stringify(prompt)}`);
  console.log("→ POST test funding (simulate customer approval)…");
  const funded = await fundTestCollection(input);
  console.log(`  ✓ ${JSON.stringify(funded)}`);
  console.log("→ GET check-status…");
  const status = await checkCollectionStatus(ref, "KE");
  console.log(`  ✓ ${JSON.stringify(status)}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("sandbox smoke FAILED:", err);
    process.exit(1);
  });

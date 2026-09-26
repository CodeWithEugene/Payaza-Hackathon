/**
 * pnpm seed:demo — wipe + reseed the FreshLeaf Exports demo story.
 * Run: node --conditions=react-server --import tsx scripts/seed-demo.ts
 */
import { seedDemo, DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demo/seed";

async function main() {
  console.log("Seeding Demo Mode data (Wanjiru / FreshLeaf Exports)…");
  const { businessId, invoiceIds } = await seedDemo();
  console.log("✓ seeded");
  console.log(`  business : ${businessId}`);
  console.log(`  login    : ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log("  invoices :");
  for (const [key, id] of Object.entries(invoiceIds)) console.log(`    ${key.padEnd(12)} ${id}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("seed failed:", err);
    process.exit(1);
  });

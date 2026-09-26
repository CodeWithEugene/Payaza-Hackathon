/**
 * pnpm replay:webhook -- <kind> <json-file-or-inline-json>
 * Replays a recorded Payaza webhook through the real pipeline (build.md §11):
 * signature check is bypassed ONLY when the payload file is a demo fixture
 * (DEMO_MODE). Usage:
 *   node --conditions=react-server --import tsx scripts/replay-webhook.ts collection ./fixtures/collection-success.json
 */
import { readFileSync } from "node:fs";
import { processWebhookPayload } from "@/lib/services/webhooks";
import { env } from "@/lib/config/env";

async function main() {
  const [kind, source] = process.argv.slice(2);
  if (!kind || !source) {
    console.error("usage: replay-webhook.ts <collection|transfer> <file.json | '{json}'>");
    process.exit(2);
  }
  const raw = source.startsWith("{") ? source : readFileSync(source, "utf8");
  const payload = JSON.parse(raw);
  const result = await processWebhookPayload(payload, {
    signatureValid: false,
    demoReplay: env.DEMO_MODE,
  });
  console.log("replay result:", JSON.stringify(result, null, 2));
  if (!env.DEMO_MODE) {
    console.warn("⚠ NOT demo mode — replayed payload was recorded as signatureValid:false");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("replay failed:", err);
    process.exit(1);
  });

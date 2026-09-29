/**
 * pnpm telegram:setup [baseUrl] — point the Telegram bot at a deployment.
 * Registers the webhook (with the secret Telegram echoes back), the command
 * menu and the bot's profile texts. Defaults to NEXT_PUBLIC_APP_URL.
 * Never prints the bot token.
 */
import { env } from "@/lib/config/env";
import { callTelegram, webhookSecret } from "@/lib/telegram/client";

async function main() {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN missing in .env.local");
  const base = (process.argv[2] ?? env.NEXT_PUBLIC_APP_URL).replace(/\/+$/, "");
  if (!base.startsWith("https://")) throw new Error(`Telegram needs an https webhook URL (got ${base})`);
  const url = `${base}/api/telegram/webhook`;

  await callTelegram("setWebhook", {
    url,
    secret_token: webhookSecret(),
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  await callTelegram("setMyCommands", {
    commands: [
      { command: "start", description: "Connect or check your Kusanya account" },
      { command: "invoices", description: "Your latest invoices" },
      { command: "link", description: "Connect your account by phone number" },
      { command: "help", description: "How to send an order" },
      { command: "unlink", description: "Disconnect this chat" },
    ],
  });
  await callTelegram("setMyDescription", {
    description:
      "Kusanya turns a buyer's order into a screened invoice with a Payaza payment link. Forward the order here, tap Send, and get paid in KES to M-Pesa.",
  });
  await callTelegram("setMyShortDescription", {
    short_description: "Buyer orders in, Payaza invoices out. Built for Kenyan exporters.",
  });
  const info = await callTelegram<{ url: string; pending_update_count: number; last_error_message?: string }>(
    "getWebhookInfo",
    {},
  );
  console.log(`✓ webhook ${info.url} (pending ${info.pending_update_count})${info.last_error_message ? ` last error: ${info.last_error_message}` : ""}`);
}

main().catch((err) => {
  console.error("telegram setup FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});

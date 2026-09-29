import "server-only";
import { z } from "zod";

/**
 * Single source of truth for environment configuration (build.md §4).
 * Every secret lives here — server-only by import guard.
 *
 * Demo Mode rule: explicitly on via NEXT_PUBLIC_DEMO_MODE=true, OR automatically
 * on when Payaza keys are absent — the app must never crash for missing keys,
 * it degrades to Demo Mode (fixtures + recorded payloads).
 *
 * Sandbox split (2026-09-28): DEMO_MODE (fixtures) and DEMO_TOOLS (reset,
 * replay, outbox, simulated settlement) are separate, so production can move
 * real sandbox money while staying resettable for judges. PAYAZA_PAYOUTS
 * keeps payouts + wallet enquiry on labeled fixtures until Payaza provisions
 * the test account's KES wallet (enquiry/main returns no wallets today).
 */

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  PAYAZA_PUBLIC_KEY: z.string().optional().default(""),
  PAYAZA_SECRET_KEY: z.string().optional().default(""),
  PAYAZA_TENANT: z.enum(["test", "live"]).default("test"),
  PAYAZA_PRODUCT_ID: z.string().default("app"),
  PAYAZA_BASE_URL: z.string().url().default("https://api.payaza.africa/live"),
  PAYAZA_CHECKOUT_MODE: z.enum(["Test", "Live"]).default("Test"),
  PAYAZA_PAYOUT_PIN: z.string().optional().default(""),

  TYPESAFE_API_KEY: z.string().optional().default(""),
  TYPESAFE_MODEL: z.string().optional().default(""),

  /** Telegram bot: chat orders → invoices (lib/telegram). */
  TELEGRAM_BOT_TOKEN: z.string().optional().default(""),
  TELEGRAM_BOT_USERNAME: z.string().optional().default("kusanya_invoice_bot"),
  /** Optional override; otherwise derived from the bot token (lib/telegram/client.ts). */
  TELEGRAM_WEBHOOK_SECRET: z.string().optional().default(""),

  /** Help chatbot answers (free-form, grounded in lib/help/knowledge.ts). */
  OPENROUTER_API_KEY: z.string().optional().default(""),
  OPENROUTER_MODEL: z.string().optional().default("z-ai/glm-5.3"),

  DATABASE_URL: z.string().optional().default(""),

  BETTER_AUTH_SECRET: z.string().optional().default(""),
  BETTER_AUTH_URL: z.string().optional().default("http://localhost:3000"),

  RESEND_API_KEY: z.string().optional().default(""),
  /** Brevo transactional email (preferred provider when set). */
  BREVO_API_KEY: z.string().optional().default(""),
  /** Must be a verified sender on the provider (Brevo: codewitheugene.top is authenticated). */
  EMAIL_FROM_ADDRESS: z.string().email().optional().default("eugene@codewitheugene.top"),
  EMAIL_FROM_NAME: z.string().optional().default("Kusanya"),
  AFRICASTALKING_USER: z.string().optional().default(""),
  AFRICASTALKING_KEY: z.string().optional().default(""),
  /** Africa's Talking (USSD + SMS). Username "sandbox" targets the sandbox API. */
  AT_API_KEY: z.string().optional().default(""),
  AT_USERNAME: z.string().optional().default("sandbox"),
  /** Optional alphanumeric sender id / shortcode (must exist on the AT account). */
  AT_SENDER_ID: z.string().optional().default(""),
  AT_USSD_CODE: z.string().optional().default("*384*11400#"),
  /** Optional override; otherwise derived from AT_API_KEY (lib/africastalking/client.ts). */
  AT_CALLBACK_TOKEN: z.string().optional().default(""),

  NEXT_PUBLIC_DEMO_MODE: z
    .enum(["true", "false"])
    .optional()
    .default("true"),
  DEMO_SEED: z.string().optional().default("wanjiru"),
  /** Demo tooling without fixtures: "true" keeps reset/replay/settle on live keys. */
  NEXT_PUBLIC_DEMO_TOOLS: z.enum(["true", "false"]).optional().default("false"),
  /** "simulated" = payouts + wallet enquiry use fixtures even with live keys. */
  PAYAZA_PAYOUTS: z.enum(["live", "simulated"]).optional().default("live"),

  /** Vercel cron secret; empty in dev = crons open (localhost only). */
  CRON_SECRET: z.string().optional().default(""),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error(
    "❌ Invalid environment configuration:",
    JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
  );
  throw new Error("Invalid environment configuration");
}

const raw = parsed.data;

/** Effective demo flag: explicit true, or missing Payaza keys (never crash). */
const demoForced = raw.NEXT_PUBLIC_DEMO_MODE === "true";
const payazaConfigured = raw.PAYAZA_PUBLIC_KEY.length > 0;

export const env = {
  ...raw,
  IS_PROD: raw.NODE_ENV === "production",
  IS_TEST: raw.NODE_ENV === "test",
  /**
   * DEMO_MODE: fixtures + recorded payloads; live Payaza/Jev calls stubbed.
   * Auto-on when PAYAZA_PUBLIC_KEY is empty — Demo Mode is the safe default.
   */
  DEMO_MODE: demoForced || !payazaConfigured,
  /** Reset / replay / outbox / simulated settlement. Always on with fixtures. */
  DEMO_TOOLS: demoForced || !payazaConfigured || raw.NEXT_PUBLIC_DEMO_TOOLS === "true",
  /** Payouts + wallet balances on fixtures (full Demo Mode, or wallet pending). */
  PAYOUTS_SIMULATED: demoForced || !payazaConfigured || raw.PAYAZA_PAYOUTS === "simulated",
  /** Live keys on the test tenant: real Payaza sandbox rails (auto-approves momo prompts). */
  SANDBOX_RAILS: !(demoForced || !payazaConfigured) && raw.PAYAZA_TENANT === "test",
  PAYAZA_CONFIGURED: payazaConfigured,
  JEV_CONFIGURED: raw.TYPESAFE_API_KEY.length > 0,
  LLM_CONFIGURED: raw.OPENROUTER_API_KEY.length > 0,
  DB_CONFIGURED: raw.DATABASE_URL.length > 0,
  NOTIFICATIONS_CONFIGURED: raw.BREVO_API_KEY.length > 0 || raw.RESEND_API_KEY.length > 0,
} as const;

export type Env = typeof env;

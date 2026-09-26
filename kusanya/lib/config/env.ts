import "server-only";
import { z } from "zod";

/**
 * Single source of truth for environment configuration (build.md §4).
 * Every secret lives here — server-only by import guard.
 *
 * Demo Mode rule: explicitly on via NEXT_PUBLIC_DEMO_MODE=true, OR automatically
 * on when Payaza keys are absent — the app must never crash for missing keys,
 * it degrades to Demo Mode (fixtures + recorded payloads).
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
  NEXT_PUBLIC_PAYAZA_MERCHANT_KEY: z.string().optional().default(""),

  TYPESAFE_API_KEY: z.string().optional().default(""),
  TYPESAFE_MODEL: z.string().optional().default(""),

  DATABASE_URL: z.string().optional().default(""),

  BETTER_AUTH_SECRET: z.string().optional().default(""),
  BETTER_AUTH_URL: z.string().optional().default("http://localhost:3000"),

  RESEND_API_KEY: z.string().optional().default(""),
  AFRICASTALKING_USER: z.string().optional().default(""),
  AFRICASTALKING_KEY: z.string().optional().default(""),

  NEXT_PUBLIC_DEMO_MODE: z
    .enum(["true", "false"])
    .optional()
    .default("true"),
  DEMO_SEED: z.string().optional().default("wanjiru"),

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
  PAYAZA_CONFIGURED: payazaConfigured,
  JEV_CONFIGURED: raw.TYPESAFE_API_KEY.length > 0,
  DB_CONFIGURED: raw.DATABASE_URL.length > 0,
  NOTIFICATIONS_CONFIGURED: raw.RESEND_API_KEY.length > 0,
} as const;

export type Env = typeof env;

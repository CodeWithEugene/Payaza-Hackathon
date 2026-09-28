import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { db } from "@/lib/db/client";
import { users, sessions, accounts, verifications } from "@/lib/db/schema";
import { env } from "@/lib/config/env";
import { sendEmail } from "@/lib/notify/email";
import { magicLinkEmail } from "@/lib/notify/templates";

/**
 * better-auth configuration (build.md §2): email+password always on (demo
 * login must work with zero external keys); magic link enabled only when
 * RESEND_API_KEY is present. Phone-OTP via Africa's Talking is v1 (spec §2).
 */
export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET || "kusanya-dev-secret-change-me",
  baseURL: env.BETTER_AUTH_URL,
  /**
   * better-auth trusts the baseURL origin automatically; both production
   * origins are listed explicitly so the canonical custom domain and the
   * gamma.vercel.app alias (still circulating in the deck/README) coexist —
   * cross-origin CSRF checks pass on either, in either env order.
   */
  trustedOrigins: [
    env.NEXT_PUBLIC_APP_URL,
    "https://kusanya.codewitheugene.top",
    "https://kusanya-gamma.vercel.app",
  ].filter((origin): origin is string => Boolean(origin)),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: false, // hackathon demo: no inbox dependency
  },
  plugins: env.RESEND_API_KEY
    ? [
        magicLink({
          sendMagicLink: async ({ email, url }) => {
            await sendEmail({
              to: email,
              subject: "Your Kusanya Sign-In Link",
              html: magicLinkEmail(url),
              tag: "magic-link",
            });
          },
        }),
      ]
    : [],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 300 },
    freshAge: 60 * 30, // re-auth for payout confirms within 30 min
  },
  /**
   * Rate limits: production keeps better-auth's strict defaults (untouched).
   * Demo Mode raises them — still bounded, never disabled — because the demo
   * story legitimately hammers sign-in: every /api/demo/reset wipes the
   * session's user (forced re-login), judges may share one NAT IP, and the
   * Playwright suite logs in several times a minute. The default sign-in
   * limit (≈10/min) locked the demo out mid-script ("Too many requests").
   */
  rateLimit: env.DEMO_TOOLS
    ? {
        enabled: true,
        window: 60,
        max: 600,
        customRules: {
          "/sign-in/email": { window: 60, max: 60 },
          "/sign-up/email": { window: 60, max: 30 },
        },
      }
    : undefined,
  advanced: {
    cookiePrefix: "kusanya",
  },
});

export type AuthSession = typeof auth.$Infer.Session;

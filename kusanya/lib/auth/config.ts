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
  trustedOrigins: [env.NEXT_PUBLIC_APP_URL],
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
              subject: "Your Kusanya sign-in link",
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
  advanced: {
    cookiePrefix: "kusanya",
  },
});

export type AuthSession = typeof auth.$Infer.Session;

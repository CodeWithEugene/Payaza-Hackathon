import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

/**
 * Browser auth client. Magic-link tab is shown only when the server enabled
 * it (NEXT_PUBLIC_MAGIC_LINK=true is set by deploy config when Resend is on).
 *
 * No baseURL: better-auth defaults to the CURRENT ORIGIN, which is correct
 * because the auth API is always same-origin as the app. Hardcoding a
 * build-time NEXT_PUBLIC_APP_URL here would break auth whenever the served
 * origin differs from the value baked at build time (preview URLs, alt ports,
 * custom domains) — the client would call the wrong host.
 */
export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

/**
 * Browser auth client. Magic-link tab is shown only when the server enabled
 * it (NEXT_PUBLIC_MAGIC_LINK=true is set by deploy config when Resend is on).
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  plugins: [magicLinkClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;

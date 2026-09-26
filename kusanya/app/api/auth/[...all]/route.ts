import { auth } from "@/lib/auth/config";

/** better-auth catch-all handler (login/signup/session/magic-link). */
const handler = auth.handler;
export { handler as GET, handler as POST };

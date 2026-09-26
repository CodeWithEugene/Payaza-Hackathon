import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "./config";
import { db } from "@/lib/db/client";
import { businesses, type Business } from "@/lib/db/schema";

/** Current session user (null when signed out). */
export async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

/** Require a signed-in user or redirect to /login. */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Require the user's business (created at signup) or redirect to onboarding. */
export async function requireBusiness(): Promise<{
  user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;
  business: Business;
}> {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(businesses)
    .where(eq(businesses.userId, user.id))
    .limit(1);
  const business = rows[0];
  if (!business) redirect("/onboarding");
  return { user, business };
}

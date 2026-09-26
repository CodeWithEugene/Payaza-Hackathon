import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { businesses, users, type Business } from "@/lib/db/schema";

/** Business + owner contact (users table carries email/phone). */
export async function getOwnerContact(businessId: string): Promise<{
  email: string | null;
  phone: string | null;
  name: string | null;
  business: Business;
} | null> {
  const rows = await db
    .select({
      email: users.email,
      phone: users.phone,
      name: users.name,
      business: businesses,
    })
    .from(businesses)
    .innerJoin(users, eq(users.id, businesses.userId))
    .where(eq(businesses.id, businessId))
    .limit(1);
  return rows[0] ?? null;
}

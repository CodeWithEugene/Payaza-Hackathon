import "server-only";
import { eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { businesses, users } from "@/lib/db/schema";
import { normalizeMsisdn } from "@/lib/payaza/endpoints";

/**
 * Who is calling? USSD and SMS callers are identified by the phone number on
 * their Kusanya account (captured at signup). Numbers are compared after
 * normalizing to 2547XXXXXXXX so "+254 700 111 222" and "0700111222" match.
 */

export interface PhoneMerchant {
  userId: string;
  businessId: string;
  businessName: string;
  email: string;
}

export function normalizeKePhone(raw: string | null | undefined): string | null {
  return raw ? normalizeMsisdn("KE", raw) : null;
}

export async function merchantForPhone(phone: string): Promise<PhoneMerchant | null> {
  const target = normalizeKePhone(phone);
  if (!target) return null;
  const rows = await db
    .select({ userId: users.id, phone: users.phone, email: users.email, businessId: businesses.id, businessName: businesses.name })
    .from(users)
    .innerJoin(businesses, eq(businesses.userId, users.id))
    .where(isNotNull(users.phone));
  const match = rows.find((r) => normalizeKePhone(r.phone) === target);
  return match
    ? { userId: match.userId, businessId: match.businessId, businessName: match.businessName, email: match.email }
    : null;
}

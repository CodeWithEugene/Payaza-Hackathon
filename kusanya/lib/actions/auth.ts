"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { db, ensureSchema } from "@/lib/db/client";
import { businesses, payoutRails } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { writeAudit } from "@/lib/db/audit";

/**
 * Signup + business bootstrap (one step — the onboarding form collects both).
 * Creates: user (better-auth), business, default M-Pesa payout rail.
 */

const signupSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  businessName: z.string().min(2).max(120),
  country: z.string().length(2).default("KE"),
  phone: z
    .string()
    .regex(/^\+?\d{9,15}$/)
    .optional()
    .or(z.literal("")),
  mpesaNumber: z
    .string()
    .regex(/^\+?254\d{9}$/, "Enter a valid Safaricom number, e.g. 0712 345 678")
    .optional()
    .or(z.literal("")),
});

export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

export async function signUpWithBusiness(
  input: z.input<typeof signupSchema>,
): Promise<ActionResult<{ userId: string; businessId: string }>> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form fields." };
  }
  const { name, email, password, businessName, country, phone, mpesaNumber } = parsed.data;

  try {
    await ensureSchema();
  } catch {
    /* migrate failure surfaces in signup error */
  }

  let userId: string;
  try {
    const signedUp = await auth.api.signUpEmail({
      body: { name, email, password },
    });
    userId = signedUp.user.id;
    if (phone) {
      const { users } = await import("@/lib/db/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(users).set({ phone }).where(eq(users.id, userId));
    }
  } catch (e) {
    const msg = String(e);
    if (/exist|already|duplicate/i.test(msg)) {
      return { ok: false, error: "An account with this email already exists — sign in instead." };
    }
    return { ok: false, error: "Signup failed. Try again in a moment." };
  }

  const businessId = newId("biz");
  const slug =
    businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) + `-${businessId.slice(-4)}`;
  await db.insert(businesses).values({
    id: businessId,
    userId,
    name: businessName,
    slug,
    country,
  });

  if (mpesaNumber) {
    const normalized = mpesaNumber.replace(/\D/g, "").replace(/^0/, "254");
    await db.insert(payoutRails).values({
      id: newId("rail"),
      businessId,
      rail: "mpesa",
      phone: normalized,
      accountName: name,
      isDefault: true,
    });
  }

  await writeAudit({
    actor: userId,
    action: "business.created",
    entityType: "businesses",
    entityId: businessId,
    after: { name: businessName, country },
  });

  // Sign them straight in.
  try {
    await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
    });
  } catch {
    /* non-fatal — they can sign in manually */
  }

  return { ok: true, data: { userId, businessId } };
}

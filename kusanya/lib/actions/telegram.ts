"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { env } from "@/lib/config/env";
import { createLinkCode, removeLinkForEmail } from "@/lib/telegram/links";
import type { ActionResult } from "./auth";

/** Settings → Telegram: one-time deep link for the signed-in user. */
export async function createTelegramLinkAction(): Promise<ActionResult<{ url: string }>> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.email) return { ok: false, error: "Not signed in." };
  if (!env.TELEGRAM_BOT_TOKEN) return { ok: false, error: "The Telegram bot isn't configured on this deployment." };
  const code = await createLinkCode(session.user.email);
  return { ok: true, data: { url: `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${code}` } };
}

const removeSchema = z.object({ linkId: z.string().regex(/^tgl_[0-9a-z]{26}$/) });

export async function removeTelegramLinkAction(linkId: string): Promise<ActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.email) return { ok: false, error: "Not signed in." };
  const parsed = removeSchema.safeParse({ linkId });
  if (!parsed.success) return { ok: false, error: "Unknown chat." };
  await removeLinkForEmail(session.user.email, parsed.data.linkId);
  revalidatePath("/app/settings");
  return { ok: true };
}

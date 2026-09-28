import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { businesses, telegramLinkCodes, telegramLinks, users } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { writeAudit } from "@/lib/db/audit";

/**
 * Telegram chat ↔ Kusanya user linking. A signed-in merchant creates a
 * one-time code (Settings → Telegram); opening t.me/<bot>?start=<code>
 * sends "/start <code>" and the webhook binds that chat to the user's email.
 */

const CODE_TTL_MS = 15 * 60 * 1000;

export async function createLinkCode(userEmail: string): Promise<string> {
  const code = randomBytes(18).toString("base64url"); // 24 chars, Telegram start-param safe
  await db.insert(telegramLinkCodes).values({
    code,
    userEmail: userEmail.toLowerCase(),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });
  return code;
}

export async function consumeLinkCode(
  code: string,
  chat: { chatId: string; username?: string | null; firstName?: string | null },
): Promise<{ ok: true; businessName: string } | { ok: false; reason: "invalid" | "no_business" }> {
  const [row] = await db
    .select()
    .from(telegramLinkCodes)
    .where(and(eq(telegramLinkCodes.code, code), isNull(telegramLinkCodes.usedAt), gt(telegramLinkCodes.expiresAt, new Date())))
    .limit(1);
  if (!row) return { ok: false, reason: "invalid" };
  await db.update(telegramLinkCodes).set({ usedAt: new Date() }).where(eq(telegramLinkCodes.code, code));

  const ctx = await contextForEmail(row.userEmail);
  if (!ctx) return { ok: false, reason: "no_business" };

  // One chat maps to one account: relinking moves it.
  await db.delete(telegramLinks).where(eq(telegramLinks.chatId, chat.chatId));
  await db.insert(telegramLinks).values({
    id: newId("tgl"),
    chatId: chat.chatId,
    userEmail: row.userEmail,
    username: chat.username?.slice(0, 64) ?? null,
    firstName: chat.firstName?.slice(0, 128) ?? null,
  });
  await writeAudit({
    actor: ctx.userId,
    action: "telegram.linked",
    entityType: "businesses",
    entityId: ctx.businessId,
    after: { username: chat.username ?? null },
  });
  return { ok: true, businessName: ctx.businessName };
}

export interface ChatContext {
  userId: string;
  businessId: string;
  businessName: string;
  email: string;
}

/** Resolve a linked chat to the CURRENT user + business (survives demo resets). */
export async function contextForChat(chatId: string): Promise<ChatContext | null> {
  const [link] = await db.select().from(telegramLinks).where(eq(telegramLinks.chatId, chatId)).limit(1);
  return link ? contextForEmail(link.userEmail) : null;
}

async function contextForEmail(email: string): Promise<ChatContext | null> {
  const [row] = await db
    .select({ userId: users.id, email: users.email, businessId: businesses.id, businessName: businesses.name })
    .from(users)
    .innerJoin(businesses, eq(businesses.userId, users.id))
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return row ? { userId: row.userId, businessId: row.businessId, businessName: row.businessName, email: row.email } : null;
}

export async function unlinkChat(chatId: string): Promise<boolean> {
  const removed = await db.delete(telegramLinks).where(eq(telegramLinks.chatId, chatId)).returning();
  return removed.length > 0;
}

export async function linksForEmail(email: string) {
  return db
    .select({ id: telegramLinks.id, username: telegramLinks.username, firstName: telegramLinks.firstName, linkedAt: telegramLinks.linkedAt })
    .from(telegramLinks)
    .where(eq(telegramLinks.userEmail, email.toLowerCase()))
    .orderBy(desc(telegramLinks.linkedAt));
}

export async function removeLinkForEmail(email: string, linkId: string): Promise<void> {
  await db.delete(telegramLinks).where(and(eq(telegramLinks.id, linkId), eq(telegramLinks.userEmail, email.toLowerCase())));
}

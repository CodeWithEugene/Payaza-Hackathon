import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { businesses, telegramLinks, users } from "@/lib/db/schema";
import { env } from "@/lib/config/env";
import { sendMessage, telegramConfigured } from "./client";
import { escapeHtml } from "./format";

/**
 * Payment-confirmed push to every Telegram chat linked to the business owner.
 * Never throws: a notification must not break a money path.
 */
export async function notifyPaidOnTelegram(opts: {
  businessId: string;
  invoiceId: string;
  invoiceNumber: string;
  amountLabel: string;
}): Promise<void> {
  if (!telegramConfigured()) return;
  try {
    const chats = await db
      .select({ chatId: telegramLinks.chatId })
      .from(businesses)
      .innerJoin(users, eq(users.id, businesses.userId))
      .innerJoin(telegramLinks, eq(telegramLinks.userEmail, users.email))
      .where(eq(businesses.id, opts.businessId));
    const url = `${env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/app/invoices/${opts.invoiceId}`;
    await Promise.all(
      chats.map(({ chatId }) =>
        sendMessage(
          chatId,
          `💰 <b>Paid:</b> invoice ${escapeHtml(opts.invoiceNumber)}, ${escapeHtml(opts.amountLabel)}. Payaza confirmed the payment.`,
          [[{ text: "View Invoice", url }]],
        ).catch((err) => console.warn("[telegram] paid notice failed:", err)),
      ),
    );
  } catch (err) {
    console.warn("[telegram] paid notice lookup failed:", err);
  }
}

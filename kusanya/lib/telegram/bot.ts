import "server-only";
import { env } from "@/lib/config/env";
import { formatMoney } from "@/lib/money/format";
import { isCurrency } from "@/lib/money/currencies";
import { cancelInvoice, listInvoices, mustGetInvoice, sendInvoice } from "@/lib/services/invoices";
import { draftInvoiceFromText } from "@/lib/services/order-intake";
import {
  answerCallback,
  editMessage,
  requestPhone,
  sendMessage,
  sendMessageClearingKeyboard,
  sendTyping,
  type InlineKeyboard,
} from "./client";
import {
  encodeCallback,
  escapeHtml,
  HELP_TEXT,
  NOT_LINKED_TEXT,
  orderSummaryHtml,
  parseCallback,
  parseMessage,
} from "./format";
import { consumeLinkCode, contextForChat, linkChatByPhone, unlinkChat, type ChatContext } from "./links";

/**
 * Telegram update handler. The merchant forwards/pastes a buyer's order; we
 * run the wizard's pipeline (order-intake) and reply with a summary plus
 * buttons. Sending to the buyer ALWAYS needs an explicit tap (money-adjacent).
 */

const MAX_ORDER_CHARS = 4_000;
const MIN_ORDER_CHARS = 12;

interface TgUser {
  id: number;
  username?: string;
  first_name?: string;
}
interface TgMessage {
  message_id: number;
  chat: { id: number; type: string };
  from?: TgUser;
  text?: string;
  caption?: string;
  photo?: unknown[];
  document?: unknown;
  voice?: unknown;
  contact?: { phone_number: string; user_id?: number; first_name?: string };
}
export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  edited_message?: TgMessage;
  callback_query?: { id: string; from: TgUser; data?: string; message?: TgMessage };
}

const appUrl = () => env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");

export async function handleUpdate(update: TgUpdate): Promise<void> {
  if (update.callback_query) return handleCallback(update.callback_query);
  const message = update.message;
  if (!message || message.chat.type !== "private") return; // private chats only
  const chatId = String(message.chat.id);
  const text = message.text ?? message.caption ?? "";

  if (message.contact) return handleContact(chatId, message);

  if (!text) {
    const media = message.photo || message.document || message.voice;
    await sendMessage(chatId, media
      ? "I can read typed or forwarded text orders for now. Please send the order as text (photos and voice notes are coming soon)."
      : HELP_TEXT);
    return;
  }

  const command = parseMessage(text);
  if (command.kind === "start") {
    if (!command.code) {
      const ctx = await contextForChat(chatId);
      if (ctx) await sendMessage(chatId, `You're connected to <b>${escapeHtml(ctx.businessName)}</b>.\n\n${HELP_TEXT}`);
      else await requestPhone(chatId, NOT_LINKED_TEXT);
      return;
    }
    const linked = await consumeLinkCode(command.code, {
      chatId,
      username: message.from?.username ?? null,
      firstName: message.from?.first_name ?? null,
    });
    await sendMessage(
      chatId,
      linked.ok
        ? `✅ Connected to <b>${escapeHtml(linked.businessName)}</b>.\n\n${HELP_TEXT}`
        : "That connect link has expired or was already used. Open Kusanya, go to Settings, then Telegram, and tap Connect Telegram again.",
    );
    return;
  }
  if (command.kind === "help" || command.kind === "unknown_command") {
    await sendMessage(chatId, HELP_TEXT);
    return;
  }
  if (command.kind === "link") {
    await requestPhone(chatId, "Tap <b>Share My Phone Number</b> and I will connect the Kusanya account that uses this number. Payment alerts for that account then come here.");
    return;
  }

  const ctx = await contextForChat(chatId);
  if (!ctx) {
    await requestPhone(chatId, NOT_LINKED_TEXT);
    return;
  }
  if (command.kind === "unlink") {
    await unlinkChat(chatId);
    await sendMessage(chatId, "This chat is disconnected from Kusanya. Connect again any time from Settings.");
    return;
  }
  if (command.kind === "invoices") return replyLatestInvoices(chatId, ctx);
  return handleOrder(chatId, ctx, command.text);
}

/** Shared contact → link the account with that phone. Only the sender's OWN number counts. */
async function handleContact(chatId: string, message: TgMessage): Promise<void> {
  const contact = message.contact!;
  if (!message.from || contact.user_id !== message.from.id) {
    await requestPhone(chatId, "Please share <b>your own</b> number with the button below, not someone else's contact.");
    return;
  }
  const linked = await linkChatByPhone(contact.phone_number, {
    chatId,
    username: message.from.username ?? null,
    firstName: message.from.first_name ?? null,
  });
  await sendMessageClearingKeyboard(
    chatId,
    linked.ok
      ? `✅ Connected to <b>${escapeHtml(linked.businessName)}</b>. Payment alerts for this account now come to this chat.\n\n${HELP_TEXT}`
      : `No Kusanya account uses this number. It has to match the phone you signed up with. You can also open Kusanya, go to <b>Settings</b>, then <b>Telegram</b>, and tap <b>Connect Telegram</b>.\n\n${escapeHtml(appUrl())}/app/settings`,
  );
}

async function handleOrder(chatId: string, ctx: ChatContext, text: string): Promise<void> {
  if (text.length < MIN_ORDER_CHARS) {
    await sendMessage(chatId, "Send me the buyer's order with the buyer name, items and total, and I'll draft the invoice. /help shows an example.");
    return;
  }
  await sendTyping(chatId);
  await sendMessage(chatId, "📝 Reading the order…");
  try {
    const outcome = await draftInvoiceFromText({
      businessId: ctx.businessId,
      actorId: ctx.userId,
      text: text.slice(0, MAX_ORDER_CHARS),
    });

    if (outcome.kind === "needs") {
      const what = outcome.missing
        .map((m) => (m === "total" ? "the total amount (for example USD 1,150)" : m === "buyer" ? "the buyer's name" : "the currency (USD, KES, UGX or TZS)"))
        .join(", ");
      await sendMessage(chatId, `I couldn't find ${what} in that message. Please send the order again with it included, or finish it in Kusanya.`, [
        [{ text: "Open New Invoice", url: `${appUrl()}/app/invoices/new` }],
      ]);
      return;
    }

    const detailUrl = `${appUrl()}/app/invoices/${outcome.invoice.id}`;
    if (outcome.kind === "flagged") {
      await sendMessage(
        chatId,
        `⚠️ <b>Invoice ${escapeHtml(outcome.invoice.number)}</b> for ${escapeHtml(outcome.buyerName)} was ${outcome.decision === "hold" ? "put on hold" : "sent to review"} by risk screening, so it has not been sent. Check the reasons in your risk queue.`,
        [[{ text: "Open Risk Queue", url: `${appUrl()}/app/review` }], [{ text: "View Invoice", url: detailUrl }]],
      );
      return;
    }

    const { invoice, extraction } = outcome;
    const currency = invoice.currency;
    const keyboard: InlineKeyboard = [
      [{ text: "✅ Send To Buyer", callback_data: encodeCallback("send", invoice.id) }],
      [
        { text: "Review In Kusanya", url: detailUrl },
        { text: "Discard", callback_data: encodeCallback("discard", invoice.id) },
      ],
    ];
    await sendMessage(
      chatId,
      orderSummaryHtml({
        number: invoice.number,
        buyerName: outcome.buyerName,
        items: extraction.items.map((i) => ({ description: i.description, qty: String(i.qty) })),
        totalLabel: isCurrency(currency) ? formatMoney(currency, Number(invoice.amountMinor)) : `${currency} ${invoice.amountMinor}`,
        dueLabel: invoice.dueAt ? invoice.dueAt.toISOString().slice(0, 10) : "on receipt",
        quality: extraction.quality,
        engine: extraction.model.startsWith("demo") ? "demo rules" : "Jev AI",
      }),
      keyboard,
    );
  } catch (err) {
    console.error("[telegram] order failed:", err);
    await sendMessage(chatId, "Something went wrong while drafting that invoice. Please try again, or create it in Kusanya.", [
      [{ text: "Open New Invoice", url: `${appUrl()}/app/invoices/new` }],
    ]);
  }
}

async function handleCallback(query: NonNullable<TgUpdate["callback_query"]>): Promise<void> {
  const parsed = parseCallback(query.data);
  const message = query.message;
  if (!parsed || !message) {
    await answerCallback(query.id);
    return;
  }
  const chatId = String(message.chat.id);
  const ctx = await contextForChat(chatId);
  if (!ctx) {
    await answerCallback(query.id, "Connect this chat to Kusanya first.");
    return;
  }
  try {
    const invoice = await mustGetInvoice(parsed.invoiceId, ctx.businessId); // business-scoped
    if (parsed.action === "send") {
      if (!["ready", "sent", "partially_paid"].includes(invoice.status)) {
        await answerCallback(query.id, `This invoice can't be sent (status: ${invoice.status}).`);
        return;
      }
      await sendInvoice(invoice.id, ctx.businessId, ctx.userId);
      const payUrl = `${appUrl()}/i/${invoice.token}`;
      await answerCallback(query.id, "Sent to the buyer");
      await editMessage(
        chatId,
        message.message_id,
        `✅ <b>Invoice ${escapeHtml(invoice.number)} sent</b>\n\nThe buyer can pay here:\n${escapeHtml(payUrl)}\n\nI'll message you as soon as Payaza confirms the payment.`,
        [[{ text: "Open Buyer Page", url: payUrl }], [{ text: "View Invoice", url: `${appUrl()}/app/invoices/${invoice.id}` }]],
      );
      return;
    }
    await cancelInvoice(invoice.id, ctx.businessId, ctx.userId, "Discarded from Telegram");
    await answerCallback(query.id, "Discarded");
    await editMessage(chatId, message.message_id, `🗑 Invoice ${escapeHtml(invoice.number)} was discarded.`);
  } catch (err) {
    console.error("[telegram] callback failed:", err);
    await answerCallback(query.id, "That didn't work. Please try again in Kusanya.");
  }
}

async function replyLatestInvoices(chatId: string, ctx: ChatContext): Promise<void> {
  const { rows } = await listInvoices(ctx.businessId, { pageSize: 5 });
  if (rows.length === 0) {
    await sendMessage(chatId, "No invoices yet. Send me a buyer's order to create your first one.");
    return;
  }
  const lines = rows.map(({ invoice, buyerName }) => {
    const amount = isCurrency(invoice.currency) ? formatMoney(invoice.currency, Number(invoice.amountMinor)) : invoice.amountMinor;
    return `• <b>${escapeHtml(invoice.number)}</b> ${escapeHtml(buyerName)}: ${escapeHtml(amount)} (${escapeHtml(invoice.status.replace(/_/g, " "))})`;
  });
  await sendMessage(chatId, `<b>Latest invoices, ${escapeHtml(ctx.businessName)}</b>\n\n${lines.join("\n")}`, [
    [{ text: "Open Invoices", url: `${appUrl()}/app/invoices` }],
  ]);
}

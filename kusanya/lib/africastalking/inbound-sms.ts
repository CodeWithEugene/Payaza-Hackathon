import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { buyers, invoices } from "@/lib/db/schema";
import { env } from "@/lib/config/env";
import { formatMoney } from "@/lib/money/format";
import { isCurrency } from "@/lib/money/currencies";
import { sendInvoice } from "@/lib/services/invoices";
import { draftInvoiceFromText } from "@/lib/services/order-intake";
import { sendSms } from "@/lib/notify/sms";
import { merchantForPhone } from "./merchant";

/**
 * Inbound SMS (Africa's Talking): the SMS twin of the Telegram bot.
 *   HELP · INVOICES · SEND <invoice number> · anything else = a buyer order
 * An order runs the wizard pipeline (Jev extraction, risk screen, Payaza link)
 * and is NOT sent until the merchant replies SEND, same as tapping in Telegram.
 */

const MIN_ORDER_CHARS = 12;
const appUrl = () => env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");

export async function handleInboundSms(input: { from: string; text: string }): Promise<void> {
  const text = input.text.trim();
  const merchant = await merchantForPhone(input.from);
  if (!merchant) {
    await sendSms(input.from, `Kusanya: this number is not linked to an account. Sign up at ${appUrl()} with this phone to invoice by SMS.`);
    return;
  }
  const upper = text.toUpperCase();

  if (upper === "HELP" || upper === "") {
    await sendSms(input.from, "Kusanya: text a buyer's order (buyer, items, total) and we draft the invoice. Reply SEND <number> to send it. INVOICES lists your latest.");
    return;
  }

  if (upper === "INVOICES") {
    const rows = await db
      .select({ number: invoices.number, currency: invoices.currency, amount: invoices.amountMinor, status: invoices.status })
      .from(invoices)
      .where(eq(invoices.businessId, merchant.businessId))
      .orderBy(desc(invoices.createdAt))
      .limit(3);
    const lines = rows.map((r) => `${r.number} ${isCurrency(r.currency) ? formatMoney(r.currency, Number(r.amount)) : r.amount} ${r.status.replace(/_/g, " ")}`);
    await sendSms(input.from, lines.length ? `Kusanya latest:\n${lines.join("\n")}` : "Kusanya: no invoices yet. Text me a buyer's order to create one.");
    return;
  }

  const send = /^SEND\s+(KSN-\d{4}-\d{4})$/.exec(upper);
  if (send) {
    const [inv] = await db
      .select({ invoice: invoices, buyerName: buyers.name })
      .from(invoices)
      .innerJoin(buyers, eq(buyers.id, invoices.buyerId))
      .where(and(eq(invoices.businessId, merchant.businessId), eq(invoices.number, send[1]!)))
      .limit(1);
    if (!inv || !["ready", "sent", "partially_paid"].includes(inv.invoice.status)) {
      await sendSms(input.from, `Kusanya: ${send[1]} was not found or can't be sent right now.`);
      return;
    }
    await sendInvoice(inv.invoice.id, merchant.businessId, merchant.userId);
    await sendSms(input.from, `Kusanya: ${send[1]} sent to ${inv.buyerName}. Pay link: ${appUrl()}/i/${inv.invoice.token}`);
    return;
  }

  if (text.length < MIN_ORDER_CHARS) {
    await sendSms(input.from, "Kusanya: send the buyer's order with the buyer name, items and total. Text HELP for commands.");
    return;
  }

  try {
    const outcome = await draftInvoiceFromText({ businessId: merchant.businessId, actorId: merchant.userId, text: text.slice(0, 2_000) });
    if (outcome.kind === "needs") {
      const what = outcome.missing.map((m) => (m === "total" ? "the total" : m === "buyer" ? "the buyer name" : "the currency")).join(", ");
      await sendSms(input.from, `Kusanya: I couldn't find ${what}. Please text the order again with it included.`);
      return;
    }
    const inv = outcome.invoice;
    const amount = isCurrency(inv.currency) ? formatMoney(inv.currency, Number(inv.amountMinor)) : inv.amountMinor;
    if (outcome.kind === "flagged") {
      await sendSms(input.from, `Kusanya: ${inv.number} for ${outcome.buyerName} (${amount}) is held for review by risk screening. Check the app.`);
      return;
    }
    await sendSms(input.from, `Kusanya: ${inv.number} ready for ${outcome.buyerName}, ${amount}. Reply SEND ${inv.number} to send it.`);
  } catch (err) {
    console.error("[sms] order failed:", err);
    await sendSms(input.from, "Kusanya: something went wrong drafting that invoice. Please try again or use the app.");
  }
}

import "server-only";
import { after } from "next/server";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { buyers, invoices, transactions } from "@/lib/db/schema";
import { env } from "@/lib/config/env";
import { formatMoney, parseAmountToMinor } from "@/lib/money/format";
import { isCurrency, type CurrencyCode } from "@/lib/money/currencies";
import { issueInvoice } from "@/lib/services/invoice-pipeline";
import { startMomoCollection } from "@/lib/services/collections";
import { sendSms } from "@/lib/notify/sms";
import { merchantForPhone, normalizeKePhone, type PhoneMerchant } from "@/lib/africastalking/merchant";
import { con, end, menu, normalizeInvoiceNumber, shortMoney, steps } from "./screens";

/**
 * Kusanya USSD (*384*11400# on the Africa's Talking sandbox).
 *
 * Registered merchants (phone on their Kusanya account):
 *   1 Collections summary · 2 Latest invoices · 3 Create invoice · 4 Pay an invoice · 5 Help
 * Anyone else (buyers):
 *   1 Pay an invoice · 2 About Kusanya
 *
 * Creating an invoice runs the same risk screen + Payaza link + send pipeline
 * as the app; paying fires a Payaza M-Pesa prompt to the caller's phone.
 */

const PAYABLE = ["sent", "ready", "partially_paid"] as const;
const MOMO_COUNTRY: Partial<Record<CurrencyCode, "KE" | "UG" | "TZ">> = { KES: "KE", UGX: "UG", TZS: "TZ" };
const BUYER_CHOICES = 4;
const DEFAULT_DUE_DAYS = 7;

const appUrl = () => env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");

/** SMS goes out after the USSD reply so the session never waits on it (AT times out slow screens). */
function textLater(to: string, message: string): void {
  after(() => sendSms(to, message));
}

export async function handleUssd(input: { phoneNumber: string; text: string }): Promise<string> {
  const path = steps(input.text);
  const merchant = await merchantForPhone(input.phoneNumber);

  if (!merchant) {
    if (path.length === 0) return menu("Welcome to Kusanya", ["Pay an invoice", "About Kusanya"]);
    if (path[0] === "1") return payFlow(input.phoneNumber, path.slice(1));
    if (path[0] === "2") return end(`Kusanya turns chat orders into invoices paid by card or M-Pesa. Merchants: sign up at ${appUrl()} and add this phone.`);
    return end("Invalid choice. Dial again to start over.");
  }

  if (path.length === 0) {
    return menu(`Kusanya: ${merchant.businessName}`, ["Collections summary", "Latest invoices", "Create invoice", "Pay an invoice", "Help"]);
  }
  switch (path[0]) {
    case "1":
      return summary(merchant);
    case "2":
      return latest(merchant);
    case "3":
      return createFlow(merchant, input.phoneNumber, path.slice(1));
    case "4":
      return payFlow(input.phoneNumber, path.slice(1));
    case "5":
      return end("Kusanya help: create invoices here or on Telegram @kusanya_invoice_bot. Buyers pay by card or M-Pesa. You get SMS and email when Payaza confirms.");
    default:
      return end("Invalid choice. Dial again to start over.");
  }
}

// ------------------------------------------------------------- merchant ----

async function summary(m: PhoneMerchant): Promise<string> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const collected = await db
    .select({ currency: transactions.currency, total: sql<string>`coalesce(sum(${transactions.amountMinor}), '0')` })
    .from(transactions)
    .where(
      and(
        eq(transactions.businessId, m.businessId),
        eq(transactions.kind, "collection"),
        eq(transactions.status, "completed"),
        gte(transactions.occurredAt, monthStart),
      ),
    )
    .groupBy(transactions.currency);
  const [open] = await db
    .select({ n: sql<number>`count(*)` })
    .from(invoices)
    .where(and(eq(invoices.businessId, m.businessId), inArray(invoices.status, [...PAYABLE])));
  const [review] = await db
    .select({ n: sql<number>`count(*)` })
    .from(invoices)
    .where(and(eq(invoices.businessId, m.businessId), inArray(invoices.status, ["review", "on_hold"])));
  const lines = collected
    .filter((c) => isCurrency(c.currency) && Number(c.total) > 0)
    .map((c) => shortMoney(formatMoney(c.currency as CurrencyCode, Number(c.total))));
  return end(
    [
      "This month collected:",
      lines.length ? lines.join(", ") : "Nothing yet",
      `Open invoices: ${Number(open?.n ?? 0)}`,
      `Needs review: ${Number(review?.n ?? 0)}`,
    ].join("\n"),
  );
}

async function latest(m: PhoneMerchant): Promise<string> {
  const rows = await db
    .select({ number: invoices.number, currency: invoices.currency, amount: invoices.amountMinor, status: invoices.status })
    .from(invoices)
    .where(eq(invoices.businessId, m.businessId))
    .orderBy(desc(invoices.createdAt))
    .limit(3);
  if (rows.length === 0) return end("No invoices yet. Choose Create invoice to make one.");
  return end(
    rows
      .map((r) => {
        const amount = isCurrency(r.currency) ? shortMoney(formatMoney(r.currency, Number(r.amount))) : r.amount;
        return `${r.number.replace("KSN-", "")} ${amount} ${r.status.replace(/_/g, " ")}`;
      })
      .join("\n"),
  );
}

/** 3 → buyer → currency → amount → confirm. */
async function createFlow(m: PhoneMerchant, callerPhone: string, path: string[]): Promise<string> {
  const buyerRows = await db
    .select({ id: buyers.id, name: buyers.name })
    .from(buyers)
    .where(eq(buyers.businessId, m.businessId))
    .orderBy(desc(buyers.createdAt))
    .limit(BUYER_CHOICES);
  if (buyerRows.length === 0) return end("Add your first buyer in the Kusanya app or on Telegram, then invoice them here.");

  if (path.length === 0) {
    return menu("Choose buyer", buyerRows.map((b) => b.name.slice(0, 28)));
  }
  const buyer = buyerRows[Number(path[0]) - 1];
  if (!buyer) return end("Invalid buyer. Dial again to start over.");

  if (path.length === 1) return menu(`Invoice ${buyer.name.slice(0, 24)} in`, ["KES", "USD"]);
  const currency: CurrencyCode | null = path[1] === "1" ? "KES" : path[1] === "2" ? "USD" : null;
  if (!currency) return end("Invalid currency. Dial again to start over.");

  if (path.length === 2) return con(`Enter the amount in ${currency}:`);
  const amountMinor = parseAmountToMinor(currency, path[2] ?? "");
  if (!amountMinor || amountMinor <= 0) return end("That amount is not valid. Dial again to start over.");
  const amountLabel = formatMoney(currency, amountMinor);

  if (path.length === 3) {
    return menu(`Invoice ${buyer.name.slice(0, 24)} ${amountLabel}?`, ["Create and send", "Cancel"]);
  }
  if (path[3] !== "1") return end("Cancelled. Nothing was created.");

  const due = new Date();
  due.setUTCDate(due.getUTCDate() + DEFAULT_DUE_DAYS);
  const { invoice, riskDecision } = await issueInvoice({
    businessId: m.businessId,
    actorId: m.userId,
    buyer: { existingId: buyer.id },
    items: [{ description: "Goods as agreed", qty: 1, unitPriceMinor: amountMinor }],
    totalMinor: amountMinor,
    currency,
    dueAt: due.toISOString(),
    feeBearer: "business",
    extractionId: null,
    sendNow: true,
  });
  if (riskDecision !== "pass") {
    return end(`${invoice.number} was created but held for review by risk screening. Check your risk queue in the app.`);
  }
  const payUrl = `${appUrl()}/i/${invoice.token}`;
  textLater(callerPhone, `Kusanya: ${invoice.number} for ${amountLabel} sent to ${buyer.name}. Pay link: ${payUrl}`);
  return end(`${invoice.number} sent to ${buyer.name} for ${amountLabel}. We texted you the pay link.`);
}

// ---------------------------------------------------------------- buyer ----

/** Enter invoice number → confirm → Payaza M-Pesa prompt to this phone. */
async function payFlow(callerPhone: string, path: string[]): Promise<string> {
  if (path.length === 0) return con("Enter the invoice number\n(for example 2026-0008):");
  const number = normalizeInvoiceNumber(path[0] ?? "");
  if (!number) return end("That invoice number is not valid. Dial again to start over.");

  const candidates = await db
    .select({ invoice: invoices, buyerPhone: buyers.phone })
    .from(invoices)
    .innerJoin(buyers, eq(buyers.id, invoices.buyerId))
    .where(and(eq(invoices.number, number), inArray(invoices.status, [...PAYABLE])))
    .orderBy(desc(invoices.createdAt))
    .limit(10);
  if (candidates.length === 0) return end(`${number} was not found or is not open for payment.`);
  const caller = normalizeKePhone(callerPhone);
  const pick = candidates.find((c) => normalizeKePhone(c.buyerPhone) === caller) ?? candidates[0]!;
  const inv = pick.invoice;
  const currency = inv.currency as CurrencyCode;
  const amountLabel = formatMoney(currency, Number(inv.amountMinor));
  const country = MOMO_COUNTRY[currency];

  if (!country) {
    const payUrl = `${appUrl()}/i/${inv.token}`;
    textLater(callerPhone, `Kusanya: pay ${inv.number} (${amountLabel}) by card here: ${payUrl}`);
    return end(`${inv.number} is in ${currency}, so it is paid by card. We texted you the payment link.`);
  }
  if (path.length === 1) return menu(`Pay ${amountLabel} for ${inv.number}?`, ["Pay with mobile money", "Cancel"]);
  if (path[1] !== "1") return end("Cancelled. You have not been charged.");

  try {
    await startMomoCollection({ invoiceId: inv.id, businessId: inv.businessId, phone: callerPhone, country });
  } catch (err) {
    return end(err instanceof Error ? err.message.slice(0, 150) : "We could not start the payment. Please try again.");
  }
  return end(`Approve the ${amountLabel} prompt on your phone. The seller is notified as soon as Payaza confirms.`);
}

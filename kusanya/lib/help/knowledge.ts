/**
 * Kusanya Help knowledge base: curated, vetted answers. The assistant never
 * generates text; Jev (or the keyword fallback) only SELECTS an article id,
 * and the UI renders the answer written here. Facts are sourced from code:
 * take rate lib/money/fees.ts, settlement ETAs lib/money/fx.ts, rails
 * lib/payaza/*. Shared by the server (routing) and the client (rendering).
 *
 * Copy rules: titles are Title Case (they render as buttons); answers are
 * sentence case with no em or en dashes.
 */

export type HelpAudience = "merchant" | "buyer" | "visitor";

export interface HelpArticle {
  id: string;
  audiences: readonly HelpAudience[];
  title: string;
  answer: string;
  /** What the article covers, for the model's criteria (not shown in UI). */
  covers: string;
  /** Lowercase stems for the offline matcher. */
  keywords: readonly string[];
  link?: { href: string; label: string };
}

const ALL: readonly HelpAudience[] = ["merchant", "buyer", "visitor"];
const SELLERS: readonly HelpAudience[] = ["merchant", "visitor"];

export const HELP_ARTICLES: readonly HelpArticle[] = [
  {
    id: "what_is_kusanya",
    audiences: ALL,
    title: "What Is Kusanya?",
    answer:
      "Kusanya turns a buyer's Telegram order into a professional invoice with a Payaza payment link. Buyers abroad pay in USD by card, Apple Pay or Google Pay, and buyers in the region can pay in KES, UGX or TZS by mobile money. The exporter receives KES in M-Pesa or a bank account, with every fee and the FX rate shown up front.",
    covers: "What the product is and who it is for",
    keywords: ["what is", "kusanya", "about", "who", "product", "does it do", "explain"],
  },
  {
    id: "create_invoice",
    audiences: SELLERS,
    title: "How Do I Create An Invoice?",
    answer:
      "Two ways. Forward the buyer's order to @kusanya_invoice_bot on Telegram (connect it once in Settings) and it replies with a screened invoice you send with one tap. Or open Invoices, choose New Invoice and paste the message. Either way Kusanya reads the buyer, items, total and due date, and amounts and dates are always resolved by code, never guessed.",
    covers: "Creating an invoice from a Telegram message or by pasting an order, AI extraction, editing and sending",
    keywords: ["create", "new invoice", "make", "telegram", "whatsapp", "paste", "extract", "send invoice", "invoice", "bot"],
    link: { href: "/app/invoices/new", label: "New Invoice" },
  },
  {
    id: "telegram_bot",
    audiences: SELLERS,
    title: "How Does The Telegram Bot Work?",
    answer:
      "In Kusanya, open Settings, then Telegram, and tap Connect Telegram to link @kusanya_invoice_bot to your account. Then forward or paste any buyer order to the bot. It reads the buyer, items, total and due date, runs the risk screen and creates the Payaza payment link. Tap Send To Buyer to send it, and the bot messages you when Payaza confirms the payment.",
    covers: "Using the Kusanya Telegram bot to create and send invoices from chat orders, connecting Telegram",
    keywords: ["telegram", "bot", "forward", "chat", "connect telegram", "kusanya_invoice_bot", "message the bot"],
    link: { href: "/app/settings", label: "Connect Telegram" },
  },
  {
    id: "ussd_sms",
    audiences: ALL,
    title: "Can I Use Kusanya By USSD Or SMS?",
    answer:
      "Yes, no smartphone needed. Dial *384*11400# (on the Africa's Talking sandbox during the demo). Merchants whose phone is on their Kusanya account can see collections, list invoices and create an invoice. Buyers choose Pay an invoice, enter the invoice number and approve the M-Pesa prompt. By SMS, text a buyer's order to create an invoice, then reply SEND with the invoice number to send it.",
    covers: "USSD code, feature phones, paying or invoicing without internet, SMS commands",
    keywords: ["ussd", "*384", "dial", "feature phone", "sms", "text message", "no internet", "no smartphone", "kabambe"],
  },
  {
    id: "fees",
    audiences: SELLERS,
    title: "What Does It Cost?",
    answer:
      "Kusanya charges a 1.5% platform fee on what you collect, and Payaza's processing fee is passed through at cost. Before you send, the settlement breakdown shows the gross amount, each fee, the FX rate and your net KES. Estimates are replaced with the actual figures once Payaza confirms the payment.",
    covers: "Pricing, fees, take rate, FX rate, net amount, transparency breakdown",
    keywords: ["fee", "cost", "price", "pricing", "charge", "percent", "%", "fx", "exchange rate", "net", "expensive"],
  },
  {
    id: "payment_methods",
    audiences: ALL,
    title: "How Can Buyers Pay?",
    answer:
      "USD invoices are paid by card, Apple Pay or Google Pay on Payaza's hosted checkout. KES, UGX and TZS invoices can be paid by mobile money in Kenya, Uganda and Tanzania: the buyer enters their number and approves the prompt on their phone. Buyers never need an account.",
    covers: "Payment methods available to the buyer: card, Apple Pay, Google Pay, M-Pesa and mobile money",
    keywords: ["pay by", "card", "visa", "mastercard", "apple pay", "google pay", "mpesa", "m-pesa", "mobile money", "method", "momo"],
  },
  {
    id: "settlement_time",
    audiences: SELLERS,
    title: "When Does The Money Arrive?",
    answer:
      "Payaza settles USD card payments in 3 to 5 business days and local mobile money payments on the next business day. Each invoice shows its expected settlement date. Once an invoice is settled you can pay out to M-Pesa or your bank.",
    covers: "How long settlement takes, when funds arrive, settlement dates",
    keywords: ["when", "how long", "arrive", "settle", "settlement", "days", "wait", "receive money", "get paid"],
  },
  {
    id: "payouts",
    audiences: ["merchant"],
    title: "How Do Payouts Work?",
    answer:
      "When an invoice is settled, choose Pay Out, pick M-Pesa or your bank, and confirm with your code. Money only moves after the code is verified. You can also turn on automatic payouts to your default account in Settings.",
    covers: "Withdrawing or paying out settled money to M-Pesa or a bank, the confirmation code, automatic payouts",
    keywords: ["payout", "pay out", "withdraw", "transfer", "bank", "mpesa", "confirmation code", "otp", "cash out"],
    link: { href: "/app/settings", label: "Payout Settings" },
  },
  {
    id: "splits",
    audiences: ["merchant"],
    title: "Can I Pay My Agent Automatically?",
    answer:
      "Yes. Add your forwarding or clearing agent on the Partners page with their share, then attach them to an invoice. Their share is paid automatically when the invoice settles, through Payaza split settlement, so you never pay agents by hand.",
    covers: "Automatic commission or share payments to agents, partners and split settlements",
    keywords: ["agent", "partner", "split", "commission", "share", "forwarder", "clearing"],
    link: { href: "/app/partners", label: "Partners" },
  },
  {
    id: "risk_review",
    audiences: ["merchant"],
    title: "Why Is My Invoice On Review Or Hold?",
    answer:
      "Every invoice is screened before it goes out: sanctions checks, unusual amounts, first time buyers, higher risk locations and mismatched details. A flagged invoice waits in your risk queue instead of being sent. You can read the reasons and override with a written reason, which is recorded in the audit log.",
    covers: "Risk screening, invoices held or in review, compliance checks, overriding a flag",
    keywords: ["review", "hold", "held", "risk", "flag", "flagged", "blocked", "sanction", "compliance", "screen"],
    link: { href: "/app/review", label: "Risk Queue" },
  },
  {
    id: "reminders",
    audiences: ["merchant"],
    title: "Can Kusanya Chase Late Payments?",
    answer:
      "Yes. Kusanya drafts polite payment reminders for unpaid invoices and checks every draft so it stays factual, with no invented fees or threats. Nothing is sent until you approve it on the invoice page.",
    covers: "Payment reminders and following up on late or overdue invoices",
    keywords: ["remind", "reminder", "late", "overdue", "chase", "follow up", "unpaid", "nudge"],
  },
  {
    id: "currencies",
    audiences: ALL,
    title: "Which Currencies And Countries Work?",
    answer:
      "Invoices can be in USD, KES, UGX or TZS. Payouts are in KES to M-Pesa or a Kenyan bank account. Rwanda is not supported yet because Payaza does not offer an RWF rail.",
    covers: "Supported currencies and countries, including Rwanda",
    keywords: ["currency", "currencies", "usd", "kes", "ugx", "tzs", "dollar", "shilling", "country", "countries", "rwanda", "uganda", "tanzania"],
  },
  {
    id: "safety",
    audiences: ALL,
    title: "Is My Money Safe?",
    answer:
      "Kusanya never holds your money. Payments run on Payaza's licensed payment rails, an invoice is only marked paid after Payaza confirms it with a signed notification, and payouts need a confirmation code. Card details are entered on Payaza's hosted checkout, never on Kusanya.",
    covers: "Security, trust, whether money and card details are safe, fraud",
    keywords: ["safe", "secure", "security", "trust", "scam", "fraud", "legit", "card details", "protect"],
  },
  {
    id: "demo",
    audiences: ALL,
    title: "How Does The Demo Work?",
    answer:
      "No real money moves here. Sign in with the demo account shown on the login page. For card payments use Mastercard 5111 1111 1111 1118 (instant) or Visa 4508 7500 1574 1019, expiry 01/39 to approve (05/39 declines) and CVV 100. For mobile money use any phone number. The payout confirmation code is 123456. You can reset the whole story from the Demo page.",
    covers: "The demo, test card numbers, demo login, sandbox, resetting demo data",
    keywords: ["demo", "test", "sandbox", "test card", "try", "judge", "reset", "login", "sign in", "password"],
    link: { href: "/demo", label: "Open Demo" },
  },
  {
    id: "buyer_how_to_pay",
    audiences: ["buyer"],
    title: "How Do I Pay This Invoice?",
    answer:
      "For a USD invoice, choose card, Apple Pay or Google Pay and complete Payaza's secure checkout. For a KES, UGX or TZS invoice, enter your mobile money number and approve the prompt on your phone. You don't need an account, and this page updates by itself once the payment is confirmed.",
    covers: "Steps for a buyer to pay the invoice in front of them",
    keywords: ["how do i pay", "pay", "payment", "checkout", "approve", "prompt", "steps"],
  },
  {
    id: "buyer_paid_not_updated",
    audiences: ["buyer"],
    title: "I Paid But It Still Shows Unpaid",
    answer:
      "Confirmation usually takes a few seconds, and mobile money can take a couple of minutes. Keep this page open because it refreshes on its own. Please don't pay twice. If it still shows unpaid after 10 minutes, contact the seller with your payment reference.",
    covers: "A buyer already paid but the invoice status did not change, or they are unsure if payment went through",
    keywords: ["already paid", "paid but", "still", "not updated", "unpaid", "pending", "went through", "deducted", "twice"],
  },
  {
    id: "buyer_receipt",
    audiences: ["buyer"],
    title: "Will I Get A Receipt?",
    answer:
      "Yes. As soon as the payment is confirmed you get a receipt by email, and the seller is notified at the same time.",
    covers: "Receipts and proof of payment for the buyer",
    keywords: ["receipt", "proof", "confirmation email", "invoice copy", "record"],
  },
  {
    id: "buyer_fees",
    audiences: ["buyer"],
    title: "Do I Pay Any Extra Fees?",
    answer:
      "You pay the amount shown on the invoice. If the seller passes the card processing fee on to you, the checkout shows the full amount before you confirm. Your own bank or card issuer may still charge a foreign transaction fee.",
    covers: "Whether the buyer pays extra fees on top of the invoice amount",
    keywords: ["extra", "fee", "charge", "surcharge", "cost", "more than", "hidden"],
  },
  {
    id: "buyer_dispute",
    audiences: ["buyer"],
    title: "The Invoice Looks Wrong",
    answer:
      "Please don't pay an invoice you disagree with. Reply to the seller's message or email with what is wrong, such as the items, quantity or price, and they can cancel it and send a corrected invoice.",
    covers: "The buyer disagrees with the invoice: wrong items, amount, quantity or price, or wants a refund",
    keywords: ["wrong", "incorrect", "mistake", "dispute", "refund", "cancel", "disagree", "overcharged", "error"],
  },
  {
    id: "contact_human",
    audiences: ALL,
    title: "Talk To A Person",
    answer:
      "For anything about a specific invoice, contact the seller who sent it. For payment problems on Payaza's side, you can email Payaza support at support@payaza.africa.",
    covers: "Reaching a human, customer support, contact details",
    keywords: ["human", "person", "agent", "support", "contact", "call", "email", "help me", "talk"],
  },
];

/** Starter chips per audience (ids, in display order). */
export const HELP_STARTERS: Record<HelpAudience, readonly string[]> = {
  merchant: ["telegram_bot", "settlement_time", "fees", "payouts"],
  buyer: ["buyer_how_to_pay", "buyer_paid_not_updated", "buyer_fees", "safety"],
  visitor: ["what_is_kusanya", "demo", "fees", "payment_methods"],
};

export const HELP_MESSAGE_MAX = 500;

export function articlesFor(audience: HelpAudience): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => a.audiences.includes(audience));
}

export function getArticle(id: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.id === id);
}

/** Map a pathname to the audience the assistant serves there. */
export function audienceForPath(pathname: string): HelpAudience {
  if (pathname.startsWith("/i/") || pathname.startsWith("/pay-done")) return "buyer";
  if (pathname.startsWith("/app")) return "merchant";
  return "visitor";
}

export interface HelpMatch {
  id: string;
  score: number;
}

/**
 * Offline matcher (Jev unavailable / Demo Mode): keyword hits, multi-word
 * keywords weigh more. Returns matches best first; empty when nothing hits.
 */
export function matchByKeywords(message: string, audience: HelpAudience): HelpMatch[] {
  const text = ` ${message.toLowerCase().replace(/[^a-z0-9%+\-' ]+/g, " ")} `;
  return articlesFor(audience)
    .map((a) => ({
      id: a.id,
      score: a.keywords.reduce(
        (sum, k) => (text.includes(k.includes(" ") ? k : ` ${k}`) ? sum + k.split(" ").length : sum),
        0,
      ),
    }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);
}

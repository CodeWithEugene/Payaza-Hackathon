/**
 * Notification templates — plain HTML strings (no external template deps).
 * Every money figure is pre-formatted by callers via lib/money (never here).
 * Swahili touches per solution §10 voice ("Imefika!").
 */

/** Email-safe hex versions of the app tokens (--primary, --brand-ink, leaf). */
const BRAND = "#5146ee";
const INK = "#0f1231";
const LEAF = "#008856";

type Audience = "buyer" | "merchant";

const FOOTER: Record<Audience, string> = {
  buyer: "You received this because a merchant sent you an invoice on Kusanya.",
  merchant: "You received this because you have a Kusanya account.",
};

function shell(
  title: string,
  body: string,
  cta?: { label: string; href: string },
  audience: Audience = "buyer",
): string {
  return `<!doctype html><html><body style="margin:0;background:#f5f5fb;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;color:#141627">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e3e3f3">
<tr><td style="height:4px;background:linear-gradient(90deg,#ffa714,#ea3fbf,#846bff,#12cbf5);font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:22px 28px;background:${INK};color:#f3f3ff">
  <span style="font-weight:800;font-size:18px;letter-spacing:-0.3px">kusanya<span style="color:#4fcc92">.</span></span>
  <span style="float:right;font-size:12px;opacity:.75">Secured by Payaza</span>
</td></tr>
<tr><td style="padding:28px"><h1 style="margin:0 0 12px;font-size:21px;letter-spacing:-0.3px">${title}</h1>${body}
${cta ? `<p style="margin:24px 0 0"><a href="${cta.href}" style="background:${BRAND};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;display:inline-block">${cta.label}</a></p>` : ""}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #eeeef7;font-size:12px;color:#676a86">
  Kusanya · Nairobi · ${FOOTER[audience]}
</td></tr></table></td></tr></table></body></html>`;
}

/** Merchant alert: a buyer paid. Every figure is pre-formatted by the caller. */
export function merchantPaidEmail(opts: {
  merchantName: string;
  invoiceNumber: string;
  buyerName: string;
  amountDisplay: string;
  methodDisplay: string;
  paidAt: string;
  invoiceUrl: string;
  attention?: string | null;
}): string {
  return shell(
    "Payment Received",
    `<p>Hi ${opts.merchantName},</p>
<p style="margin:0 0 6px;color:#676a86;font-size:13px;text-transform:uppercase;letter-spacing:.6px">Amount received</p>
<p style="margin:0 0 16px;font-size:30px;font-weight:800;color:${LEAF};letter-spacing:-0.5px">${opts.amountDisplay}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;border-collapse:collapse">
<tr><td style="padding:8px 0;color:#676a86">Invoice</td><td style="padding:8px 0;text-align:right;font-weight:600">${opts.invoiceNumber}</td></tr>
<tr><td style="padding:8px 0;color:#676a86;border-top:1px solid #eeeef7">Buyer</td><td style="padding:8px 0;text-align:right;border-top:1px solid #eeeef7">${opts.buyerName}</td></tr>
<tr><td style="padding:8px 0;color:#676a86;border-top:1px solid #eeeef7">Paid with</td><td style="padding:8px 0;text-align:right;border-top:1px solid #eeeef7">${opts.methodDisplay}</td></tr>
<tr><td style="padding:8px 0;color:#676a86;border-top:1px solid #eeeef7">When</td><td style="padding:8px 0;text-align:right;border-top:1px solid #eeeef7">${opts.paidAt}</td></tr>
</table>
${opts.attention ? `<p style="margin:16px 0 0;padding:12px 14px;border-radius:10px;background:#fff4e5;color:#8a4b00;font-size:14px">${opts.attention}</p>` : ""}
<p style="margin:16px 0 0;color:#676a86;font-size:13px">Payaza confirmed this payment. Settlement to your wallet follows, and you can pay out to M-Pesa once it lands.</p>`,
    { label: "View Invoice", href: opts.invoiceUrl },
    "merchant",
  );
}

export function magicLinkEmail(url: string): string {
  return shell(
    "Sign In To Kusanya",
    `<p>Tap below to sign in. This link expires in 10 minutes.</p>`,
    { label: "Sign In", href: url },
    "merchant",
  );
}

export function invoiceEmail(opts: {
  buyerName: string;
  merchantName: string;
  invoiceNumber: string;
  amountDisplay: string;
  dueDisplay: string;
  payUrl: string;
  paymentMethods: string;
}): string {
  return shell(
    `Invoice ${opts.invoiceNumber} From ${opts.merchantName}`,
    `<p>Hi ${opts.buyerName},</p>
<p>${opts.merchantName} has sent you an invoice for <strong>${opts.amountDisplay}</strong>, due <strong>${opts.dueDisplay}</strong>.</p>
<p>Pay in about 2 minutes, no account needed. Methods: ${opts.paymentMethods}.</p>`,
    { label: `Pay ${opts.amountDisplay}`, href: opts.payUrl },
  );
}

export function receiptEmail(opts: {
  buyerName: string;
  invoiceNumber: string;
  amountDisplay: string;
  reference: string;
  paidAt: string;
  receiptUrl?: string | null;
}): string {
  return shell(
    "Payment Received ✓",
    `<p>Hi ${opts.buyerName},</p>
<p>We received <strong>${opts.amountDisplay}</strong> for invoice <strong>${opts.invoiceNumber}</strong> on ${opts.paidAt}.</p>
<p style="color:#676a86;font-size:13px">Reference: ${opts.reference}</p>`,
    opts.receiptUrl ? { label: "Download Receipt", href: opts.receiptUrl } : undefined,
  );
}

export function reminderEmail(opts: {
  buyerName: string;
  invoiceNumber: string;
  amountDisplay: string;
  dueDisplay: string;
  payUrl: string;
  merchantName: string;
}): string {
  return shell(
    `Friendly Reminder: ${opts.invoiceNumber}`,
    `<p>Hi ${opts.buyerName},</p>
<p>Just a reminder that invoice <strong>${opts.invoiceNumber}</strong> for <strong>${opts.amountDisplay}</strong> is due <strong>${opts.dueDisplay}</strong>.</p>
<p>If you've already paid, you can ignore this. Thank you!</p>
<p style="color:#676a86;font-size:13px">Sent on behalf of ${opts.merchantName}</p>`,
    { label: "View & Pay Invoice", href: opts.payUrl },
  );
}

export function payoutSentEmail(opts: {
  merchantName: string;
  amountDisplay: string;
  destination: string;
  etaDisplay: string;
  invoiceNumber: string;
}): string {
  return shell(
    "Imefika! 🎉 Your Payout Is On The Way",
    `<p>Habari ${opts.merchantName},</p>
<p><strong>${opts.amountDisplay}</strong> from invoice ${opts.invoiceNumber} is on its way to <strong>${opts.destination}</strong>.</p>
<p>Expected: <strong>${opts.etaDisplay}</strong> (Payaza settlement SLA).</p>
<p style="color:#676a86;font-size:13px">Every fee, the FX rate and splits are itemized in your transparency panel.</p>`,
    undefined,
    "merchant",
  );
}

export function payoutFailedEmail(opts: {
  merchantName: string;
  amountDisplay: string;
  reason: string;
}): string {
  return shell(
    "Payout Needs Your Attention",
    `<p>Habari ${opts.merchantName},</p>
<p>Your payout of <strong>${opts.amountDisplay}</strong> could not complete: ${opts.reason}.</p>
<p>Your funds are safe in your settlement balance. Update your payout details and retry; it takes one tap.</p>`,
    undefined,
    "merchant",
  );
}

export function splitStatementEmail(opts: {
  partnerName: string;
  merchantName: string;
  period: string;
  lines: { invoice: string; amount: string }[];
  totalDisplay: string;
}): string {
  const rows = opts.lines
    .map(
      (l) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #eef0ec">${l.invoice}</td><td style="padding:6px 0;border-bottom:1px solid #eef0ec;text-align:right;font-family:ui-monospace,monospace">${l.amount}</td></tr>`,
    )
    .join("");
  return shell(
    `Your Statement From ${opts.merchantName}`,
    `<p>Hi ${opts.partnerName}, here is your split settlement statement for ${opts.period}:</p>
<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px">${rows}
<tr><td style="padding:10px 0;font-weight:800">Total settled</td><td style="padding:10px 0;text-align:right;font-weight:800;font-family:ui-monospace,monospace">${opts.totalDisplay}</td></tr></table>`,
  );
}

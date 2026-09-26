/**
 * Notification templates — plain HTML strings (no external template deps).
 * Every money figure is pre-formatted by callers via lib/money (never here).
 * Swahili touches per solution §10 voice ("Imefika!").
 */

const BRAND = "#16a34a";

function shell(title: string, body: string, cta?: { label: string; href: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f5f3;font-family:ui-sans-serif,system-ui,sans-serif;color:#141a15">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e4e7e2">
<tr><td style="padding:22px 28px;background:#0f1510;color:#eaf2eb">
  <span style="font-weight:800;font-size:18px">kusanya<span style="color:${BRAND === "#16a34a" ? "#a8fc84" : BRAND}">.</span></span>
  <span style="float:right;font-size:12px;opacity:.7">Secured by Payaza</span>
</td></tr>
<tr><td style="padding:28px"><h1 style="margin:0 0 12px;font-size:20px">${title}</h1>${body}
${cta ? `<p style="margin:22px 0 0"><a href="${cta.href}" style="background:${BRAND};color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:700;display:inline-block">${cta.label}</a></p>` : ""}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #eef0ec;font-size:12px;color:#6b7c6e">
  Kusanya · Nairobi · You received this because a merchant sent you an invoice on Kusanya.
</td></tr></table></td></tr></table></body></html>`;
}

export function magicLinkEmail(url: string): string {
  return shell(
    "Sign in to Kusanya",
    `<p>Tap below to sign in — this link expires in 10 minutes.</p>`,
    { label: "Sign in", href: url },
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
    `Invoice ${opts.invoiceNumber} from ${opts.merchantName}`,
    `<p>Hi ${opts.buyerName},</p>
<p>${opts.merchantName} has sent you an invoice for <strong>${opts.amountDisplay}</strong>, due <strong>${opts.dueDisplay}</strong>.</p>
<p>Pay in about 2 minutes — no account needed. Methods: ${opts.paymentMethods}.</p>`,
    { label: `Pay ${opts.amountDisplay}`, href: opts.payUrl },
  );
}

export function receiptEmail(opts: {
  buyerName: string;
  invoiceNumber: string;
  amountDisplay: string;
  reference: string;
  paidAt: string;
}): string {
  return shell(
    "Payment received ✓",
    `<p>Hi ${opts.buyerName},</p>
<p>We received <strong>${opts.amountDisplay}</strong> for invoice <strong>${opts.invoiceNumber}</strong> on ${opts.paidAt}.</p>
<p style="color:#6b7c6e;font-size:13px">Reference: ${opts.reference}</p>`,
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
    `Friendly reminder: ${opts.invoiceNumber}`,
    `<p>Hi ${opts.buyerName},</p>
<p>Just a reminder that invoice <strong>${opts.invoiceNumber}</strong> for <strong>${opts.amountDisplay}</strong> is due <strong>${opts.dueDisplay}</strong>.</p>
<p>If you've already paid, you can ignore this — thank you!</p>
<p style="color:#6b7c6e;font-size:13px">— sent on behalf of ${opts.merchantName}</p>`,
    { label: "View & pay invoice", href: opts.payUrl },
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
    "Imefika! 🎉 Your payout is on the way",
    `<p>Habari ${opts.merchantName},</p>
<p><strong>${opts.amountDisplay}</strong> from invoice ${opts.invoiceNumber} is on its way to <strong>${opts.destination}</strong>.</p>
<p>Expected: <strong>${opts.etaDisplay}</strong> (Payaza settlement SLA).</p>
<p style="color:#6b7c6e;font-size:13px">Every fee, the FX rate and splits are itemized in your transparency panel.</p>`,
  );
}

export function payoutFailedEmail(opts: {
  merchantName: string;
  amountDisplay: string;
  reason: string;
}): string {
  return shell(
    "Payout needs your attention",
    `<p>Habari ${opts.merchantName},</p>
<p>Your payout of <strong>${opts.amountDisplay}</strong> could not complete: ${opts.reason}.</p>
<p>Your funds are safe in your settlement balance. Update your payout details and retry — it takes one tap.</p>`,
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
    `Your statement from ${opts.merchantName}`,
    `<p>Hi ${opts.partnerName}, here is your split settlement statement for ${opts.period}:</p>
<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px">${rows}
<tr><td style="padding:10px 0;font-weight:800">Total settled</td><td style="padding:10px 0;text-align:right;font-weight:800;font-family:ui-monospace,monospace">${opts.totalDisplay}</td></tr></table>`,
  );
}

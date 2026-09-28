import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock, HelpCircle, ReceiptText } from "lucide-react";
import { handleCheckoutCallback } from "@/lib/services/collections";
import { isWellFormedToken, receiptTokenForReference } from "@/lib/services/documents";
import { getBuyerInvoice } from "@/lib/services/invoices";
import { formatMinor } from "@/lib/money/format";
import { isCurrency } from "@/lib/money/currencies";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PayDoneRefresh } from "@/components/buyer/pay-done-refresh";

/**
 * /pay-done?ref=… — where Payaza drops the buyer. Two reference kinds arrive:
 *  - "KSN-…" merchant transaction reference from the Checkout SDK → verify
 *    server-side (merchantTransactionQuery → single completion path).
 *  - invoice token from a hosted payment-link redirect_url → read the ledger:
 *    if the invoice shows paid, confirm; otherwise honest "not yet" (webhooks
 *    and polling complete it server-side — the redirect is only ever a hint).
 * No auth.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Payment Status" };

type Props = { searchParams: Promise<{ ref?: string | string[] }> };

type Outcome = "verified" | "pending" | "unknown";
const PAID_STATES = new Set([
  "partially_paid",
  "paid",
  "settling",
  "settled",
  "paying_out",
  "completed",
]);

export default async function PayDonePage({ searchParams }: Props) {
  const sp = await searchParams;
  const rawRef = Array.isArray(sp.ref) ? sp.ref[0] : sp.ref;
  if (!rawRef) redirect("/");

  let outcome: Outcome = "unknown";
  let detail: string | null = null;
  // Invoice token for the receipt link, resolved server-side and only once
  // money has landed. Never taken from anything but a verified outcome.
  let receiptToken: string | null = null;

  if (rawRef.startsWith("KSN-")) {
    try {
      const result = await handleCheckoutCallback(rawRef);
      outcome = !result.found ? "unknown" : result.verified ? "verified" : "pending";
      if (outcome === "verified") {
        // A failed lookup only hides the receipt button; it never changes the outcome.
        receiptToken = await receiptTokenForReference(rawRef).catch(() => null);
      }
    } catch {
      // Verification call failed (Payaza unreachable etc.) — be honest: we
      // can't confirm yet; webhooks complete it server-side.
      outcome = "pending";
    }
  } else {
    // Hosted-link redirect carries the invoice token — the ledger decides.
    try {
      const view = await getBuyerInvoice(rawRef);
      if (view) {
        const inv = view.invoice;
        if (PAID_STATES.has(inv.status)) {
          outcome = "verified";
          const done = view.transactions.find((t) => t.status === "completed");
          if (done && isWellFormedToken(rawRef)) receiptToken = rawRef;
          if (done && isCurrency(inv.currency)) {
            detail = `${inv.number} · ${formatMinor(inv.currency, Number(done.amountMinor))}`;
          } else {
            detail = inv.number;
          }
        } else if (["sent", "ready"].includes(inv.status)) {
          outcome = "pending";
        }
      }
    } catch {
      outcome = "unknown";
    }
  }

  return (
    <main className="k-auth-canvas flex min-h-svh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <p className="text-center font-mono text-sm font-semibold tracking-tight text-muted-foreground">
          kusanya
        </p>

        <Card>
          {outcome === "verified" && (
            <CardHeader className="items-center text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 className="size-8" />
              </span>
              <CardTitle>Payment Confirmed ✅</CardTitle>
              <CardDescription>
                Payaza confirmed your payment. The merchant has been notified and your
                receipt is on its way.
              </CardDescription>
              {detail && (
                <p className="font-mono text-sm tabular-nums text-muted-foreground">{detail}</p>
              )}
            </CardHeader>
          )}

          {outcome === "pending" && (
            <CardHeader className="items-center text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Clock className="size-8" />
              </span>
              <CardTitle>Confirming Your Payment</CardTitle>
              <CardDescription>
                Payaza is still confirming this payment, which usually takes a few seconds. Please
                keep this page open and don&apos;t pay twice.
              </CardDescription>
              <PayDoneRefresh />
            </CardHeader>
          )}

          {outcome === "unknown" && (
            <CardHeader className="items-center text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <HelpCircle className="size-8" />
              </span>
              <CardTitle>Reference Not Recognised</CardTitle>
              <CardDescription>
                We couldn&apos;t find a payment with that reference. If you just paid, give it a
                few minutes and check with the merchant.
              </CardDescription>
            </CardHeader>
          )}

          <CardContent className="flex flex-wrap justify-center gap-2">
            {outcome === "verified" && receiptToken && (
              <Button asChild>
                <a
                  href={`/api/buyer/receipt?token=${encodeURIComponent(receiptToken)}`}
                  download
                >
                  <ReceiptText data-icon="inline-start" />
                  Download Receipt
                </a>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href="/">Back To Kusanya</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Ban, CheckCircle2, ChevronDown, ReceiptText, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { buyers } from "@/lib/db/schema";
import { getBuyerInvoice } from "@/lib/services/invoices";
import { env } from "@/lib/config/env";
import { Amount, formatAmountMinor } from "@/components/money/amount";
import { StatusBadge } from "@/components/invoices/status-badge";
import { PayPanel } from "@/components/buyer/pay-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ModeToggle } from "@/components/mode-toggle";
import { KusanyaMark } from "@/components/brand/logo";

/**
 * /i/[token] — the public buyer invoice + payment page. No session, no app
 * shell: a buyer opens a link from email/SMS/WhatsApp and must land on a
 * calm, trustworthy checkout. Token is the capability; getBuyerInvoice
 * returns only buyer-safe fields.
 */

const PAYABLE_STATUSES = ["sent", "ready", "partially_paid"];
const SUCCESS_STATUSES = ["paid", "settling", "settled", "paying_out", "completed"];

const CHANNEL_LABELS: Record<string, string> = {
  card: "Card",
  momo_ke: "Mobile money · Kenya",
  momo_ug: "Mobile money · Uganda",
  momo_tz: "Mobile money · Tanzania",
  payment_link: "Payment link",
};

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const inv = await getBuyerInvoice(token);
  if (!inv) return { title: "Invoice not found" };
  return {
    title: `Invoice ${inv.invoice.number} · ${inv.business?.name ?? "Kusanya"}`,
  };
}

export default async function BuyerInvoicePage({ params }: Props) {
  const { token } = await params;
  const inv = await getBuyerInvoice(token);
  if (!inv) notFound();

  const { invoice, business, buyer, items, transactions } = inv;
  const businessName = business?.name ?? "Your seller";

  // Buyer contact for the checkout SDK fallbacks (getBuyerInvoice's buyer
  // projection intentionally omits email — read it here, server-side only).
  const [buyerRow] = await db
    .select({ email: buyers.email })
    .from(buyers)
    .where(eq(buyers.id, invoice.buyerId))
    .limit(1);

  const amountMinorNum = Number(invoice.amountMinor);
  const amountLabel = formatAmountMinor(amountMinorNum, invoice.currency);
  const payable = PAYABLE_STATUSES.includes(invoice.status);
  const success = SUCCESS_STATUSES.includes(invoice.status);
  const overdue = !!invoice.dueAt && payable && invoice.dueAt.getTime() < Date.now();

  const paidMinor = transactions
    .filter((t) => t.status === "completed")
    .reduce((sum, t) => sum + Number(t.amountMinor), 0);
  const remainingMinor = Math.max(0, amountMinorNum - paidMinor);
  const latestCompleted = transactions.find((t) => t.status === "completed") ?? null;
  // The token already in this page's URL is the capability; nothing else is added.
  const receiptHref = `/api/buyer/receipt?token=${encodeURIComponent(invoice.token)}`;

  return (
    <div className="k-auth-canvas min-h-svh">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8 sm:py-12">
        {/* Header: who is billing + the kusanya wordmark */}
        <header className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-medium">{businessName}</p>
          <div className="flex shrink-0 items-center gap-2">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              invoices via
              <KusanyaMark className="size-3.5" />
              <span className="font-mono font-semibold tracking-tight">kusanya</span>
            </p>
            <ModeToggle />
          </div>
        </header>

        {/* Invoice card */}
        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-base tracking-tight">{invoice.number}</CardTitle>
            <CardAction>
              <StatusBadge status={invoice.status} />
            </CardAction>
            <CardDescription>
              From {businessName}
              {buyer ? ` · Billed to ${buyer.name}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {items.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, i) => (
                    <TableRow key={`${item.description.slice(0, 24)}-${i}`}>
                      <TableCell className="font-normal">{item.description}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{item.qty}</TableCell>
                      <TableCell className="text-right">
                        {Number(item.unitPriceMinor) > 0 ? (
                          <Amount minor={Number(item.unitPriceMinor)} currency={invoice.currency} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <Separator />

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{payable ? "Total due" : "Total"}</span>
              <Amount
                minor={amountMinorNum}
                currency={invoice.currency}
                className="text-xl font-semibold"
              />
            </div>

            {invoice.status === "partially_paid" && remainingMinor > 0 && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Remaining due</span>
                <Amount
                  minor={remainingMinor}
                  currency={invoice.currency}
                  className="text-sm font-medium"
                />
              </div>
            )}

            {invoice.dueAt && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Due {fmtDate(invoice.dueAt)}</span>
                {overdue && <Badge variant="destructive">Overdue</Badge>}
              </div>
            )}

            {invoice.notes && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-line text-muted-foreground">
                <span className="font-medium text-foreground">Note from the seller: </span>
                {invoice.notes}
              </div>
            )}

            {invoice.feeBearer === "customer" && (
              <p className="text-xs text-muted-foreground">
                Payment processing fees are added at checkout.
              </p>
            )}
          </CardContent>
        </Card>

        {invoice.status === "partially_paid" && latestCompleted && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" asChild>
              <a href={receiptHref} download>
                <ReceiptText data-icon="inline-start" />
                Download Receipt
              </a>
            </Button>
          </div>
        )}

        {/* Payment / outcome by status */}
        {payable && (
          <PayPanel
            token={invoice.token}
            status={invoice.status}
            currency={invoice.currency}
            amountMinor={invoice.amountMinor}
            amountLabel={amountLabel}
            businessName={businessName}
            buyerName={buyer?.name ?? ""}
            buyerEmail={buyerRow?.email ?? ""}
            demoMode={env.DEMO_MODE}
            sandbox={env.SANDBOX_RAILS}
            // Payaza serves test-mode payment links as "Link not found", so the
            // hosted-link fallback is offered on the live tenant only.
            payazaLinkUrl={env.PAYAZA_TENANT === "live" ? invoice.payazaLinkUrl : null}
          />
        )}

        {success && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 className="size-8" />
              </span>
              <h2 className="text-lg font-semibold">Paid — asante!</h2>
              <StatusBadge status={invoice.status} />
              {latestCompleted && (
                <p className="text-sm text-muted-foreground">
                  <Amount
                    minor={Number(latestCompleted.amountMinor)}
                    currency={latestCompleted.currency}
                    className="font-medium text-foreground"
                  />{" "}
                  received{latestCompleted.occurredAt ? ` on ${fmtDate(latestCompleted.occurredAt)}` : ""}.
                  A receipt went to your email.
                </p>
              )}
              {latestCompleted && (
                <Button variant="outline" asChild>
                  <a href={receiptHref} download>
                    <ReceiptText data-icon="inline-start" />
                    Download Receipt
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {invoice.status === "failed" && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <XCircle className="size-10 text-destructive" />
              <h2 className="text-lg font-semibold">This payment didn&apos;t go through.</h2>
              <p className="text-sm text-muted-foreground">
                If money left your account, your provider will return it or it will reflect
                shortly. The merchant can resend the invoice if payment is still due.
              </p>
            </CardContent>
          </Card>
        )}

        {invoice.status === "cancelled" && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <Ban className="size-10 text-muted-foreground" />
              <h2 className="text-lg font-semibold">This invoice was cancelled</h2>
              <p className="text-sm text-muted-foreground">
                No payment is needed. Contact the merchant if you believe this is a mistake.
              </p>
            </CardContent>
          </Card>
        )}

        {(invoice.status === "review" || invoice.status === "on_hold") && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                This invoice is being confirmed by the seller — you&apos;ll be able to pay shortly.
              </p>
            </CardContent>
          </Card>
        )}

        {invoice.status === "draft" && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                This invoice isn&apos;t ready for payment yet — the seller is still preparing it.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Payment attempts history (only once nothing is payable) */}
        {!payable && transactions.length > 0 && (
          <Collapsible className="rounded-lg border border-border bg-card">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground">
              Payment attempts
              <ChevronDown className="size-4" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex flex-col gap-2 px-4 pb-4">
                {transactions.map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-medium">
                        {CHANNEL_LABELS[txn.channel] ?? txn.channel}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {txn.occurredAt ? fmtDate(txn.occurredAt) : "—"}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Amount minor={Number(txn.amountMinor)} currency={txn.currency} />
                      <StatusBadge status={txn.status} />
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        <footer className="pb-4 text-center text-xs text-muted-foreground">
          Secured by Payaza · Kusanya shows sellers exactly what you paid, fees included.
        </footer>
      </main>
    </div>
  );
}

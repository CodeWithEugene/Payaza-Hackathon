import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft, FileDown, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/export/export-menu";
import { dateTimeText, moneyText, statusText } from "@/lib/export/format";
import type { ExportColumn, ExportRow } from "@/lib/export/types";
import { RECEIPT_STATUSES } from "@/lib/services/documents";
import { requireBusiness } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { payoutRails } from "@/lib/db/schema";
import { getInvoiceDetail } from "@/lib/services/invoices";
import { invoiceWaterfall } from "@/lib/services/waterfall";
import { env } from "@/lib/config/env";
import { mask } from "@/lib/ids";
import { formatMinor } from "@/lib/money/format";
import type { CurrencyCode } from "@/lib/money/currencies";
import { Amount } from "@/components/money/amount";
import { StatusBadge } from "@/components/invoices/status-badge";
import { Timeline, type TimelineEvent } from "@/components/invoices/timeline";
import { WaterfallPanel } from "@/components/invoices/waterfall-panel";
import { RiskCard } from "@/components/invoices/risk-card";
import { RemindersCard } from "@/components/invoices/reminders-card";
import { ReplayPanel } from "@/components/invoices/replay-panel";
import { PayoutDialog } from "@/components/invoices/payout-dialog";
import { SendButton } from "@/components/invoices/send-button";
import { CopyLinkButton } from "@/components/invoices/copy-link-button";
import { CancelButton } from "@/components/invoices/cancel-button";
import { SimulateSettleButton } from "@/components/invoices/simulate-settle-button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const CHANNEL_LABELS: Record<string, string> = {
  card: "Card",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  payment_link: "Payment link",
  momo_ke: "M-Pesa (KE)",
  momo_ug: "Mobile money (UG)",
  momo_tz: "Mobile money (TZ)",
  mpesa_payout: "M-Pesa payout",
  kepss_payout: "Bank payout (kepss)",
  virtual_account: "Virtual account",
  manual: "Manual",
};

const ITEM_COLUMNS: ExportColumn[] = [
  { key: "description", header: "Description" },
  { key: "qty", header: "Qty", align: "right" },
  { key: "unitPrice", header: "Unit Price", align: "right" },
  { key: "total", header: "Total", align: "right" },
];

const TXN_COLUMNS: ExportColumn[] = [
  { key: "reference", header: "Reference", nowrap: true },
  { key: "payazaReference", header: "Payaza Reference", nowrap: true },
  { key: "channel", header: "Channel" },
  { key: "amount", header: "Amount", align: "right" },
  { key: "fee", header: "Fee", align: "right" },
  { key: "net", header: "Net", align: "right" },
  { key: "status", header: "Status" },
  { key: "when", header: "When", nowrap: true },
];

function channelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

interface DetailProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: DetailProps): Promise<Metadata> {
  const { id } = await params;
  const { business } = await requireBusiness();
  try {
    const detail = await getInvoiceDetail(business.id, id);
    return { title: `Invoice ${detail.invoice.number}` };
  } catch {
    return { title: "Invoice" };
  }
}

export default async function InvoiceDetailPage({ params }: DetailProps) {
  const { id } = await params;
  const { business } = await requireBusiness();

  let detail: Awaited<ReturnType<typeof getInvoiceDetail>>;
  try {
    detail = await getInvoiceDetail(business.id, id);
  } catch {
    notFound();
  }

  const { invoice, buyer, items, transactions: txns, payouts: payoutRows, risk, reminders } =
    detail;
  const waterfall = await invoiceWaterfall(invoice);
  const rails = await db
    .select()
    .from(payoutRails)
    .where(eq(payoutRails.businessId, business.id))
    .orderBy(desc(payoutRails.isDefault));
  const demoMode = env.DEMO_TOOLS;

  // Serializable props for the client islands.
  const railOptions = rails.map((r) => ({
    id: r.id,
    rail: r.rail,
    phone: r.phone,
    accountNumber: r.accountNumber,
    accountName: r.accountName,
    bankCode: r.bankCode,
    isDefault: r.isDefault,
  }));
  const reminderRows = reminders.map((r) => ({
    id: r.id,
    channel: r.channel,
    body: r.body,
    scheduledAt: r.scheduledAt,
    sentAt: r.sentAt,
    status: r.status,
    draftedBy: r.draftedBy,
    guardrail: r.guardrail,
  }));

  // Demo replay references: prefer a still-open collection txn; payouts by kind.
  const collectionTxns = txns.filter((t) => t.kind === "collection");
  const collectionRef =
    (collectionTxns.find((t) => t.status === "pending" || t.status === "initialized") ??
      collectionTxns[0])?.merchantReference ?? null;
  const payoutRef = txns.find((t) => t.kind === "payout")?.merchantReference ?? null;

  // ------------------------------------------------------------- timeline --
  const events: TimelineEvent[] = [
    {
      at: invoice.createdAt,
      icon: "created",
      title: "Invoice created",
      detail: buyer ? `For ${buyer.name} · ${buyer.country}` : undefined,
    },
  ];
  if (invoice.issuedAt) {
    events.push({
      at: invoice.issuedAt,
      icon: "send",
      title: "Sent to buyer",
      detail: "Payment link delivered — the buyer can pay by card or mobile money.",
    });
  }
  if (risk) {
    events.push({
      at: risk.createdAt,
      icon: "flag",
      title:
        risk.decision === "pass"
          ? "Risk screening passed"
          : risk.decision === "review"
            ? "Flagged for review by risk screening"
            : "Put on hold by risk screening",
      detail: `Composite score ${risk.compositeScore}/100${risk.fallback ? " · rule-based screening" : ""}`,
      tone: risk.decision === "hold" ? "destructive" : "default",
    });
  }
  for (const r of reminders) {
    if (r.status === "sent" && r.sentAt) {
      events.push({
        at: r.sentAt,
        icon: "reminder",
        title: `Reminder sent via ${r.channel}`,
      });
    }
  }
  for (const t of txns) {
    const at = t.occurredAt ?? t.createdAt;
    if (t.kind === "collection") {
      if (t.status === "completed") {
        events.push({
          at,
          icon: "paid",
          title: `Payment received — ${formatMinor(t.currency as CurrencyCode, Number(t.amountMinor))}`,
          detail: `Via ${channelLabel(t.channel)} · ref ${t.merchantReference}`,
        });
      } else if (t.status === "failed") {
        events.push({
          at,
          icon: "flag",
          title: "Payment attempt failed",
          detail: `Via ${channelLabel(t.channel)} — nothing was collected; the invoice is still open.`,
          tone: "destructive",
        });
      }
    } else if (t.kind === "payout") {
      const payout = payoutRows.find((p) => p.transactionId === t.id);
      if (t.status === "completed") {
        events.push({
          at,
          icon: "payout",
          title: `Imefika! KES landed in ${payout ? mask(payout.beneficiaryAccount) : "your account"}`,
          detail: `${formatMinor("KES", Number(t.amountMinor))} paid out via ${channelLabel(t.channel)}.`,
        });
      } else if (t.status === "failed") {
        events.push({
          at,
          icon: "payout",
          title: "Payout failed — your funds are safe",
          detail: "The destination rejected the transfer. Check your rail details in Settings and try again.",
          tone: "destructive",
        });
      }
    }
  }
  events.sort((a, b) => a.at.getTime() - b.at.getTime());

  // -------------------------------------------------------------- actions --
  const s = invoice.status;
  const canCancel = ["draft", "ready", "sent", "partially_paid", "review", "on_hold"].includes(s);
  const canReceipt =
    RECEIPT_STATUSES.includes(s) &&
    txns.some((t) => t.kind === "collection" && t.status === "completed");

  // ------------------------------------------------------------ exports --
  const itemRows: ExportRow[] = items.map((item) => {
    const qty = Number(item.qty);
    const unit = Math.round(Number(item.unitPriceMinor));
    return {
      description: item.description,
      qty: String(qty),
      unitPrice: unit > 0 ? moneyText(item.currency, unit) : "",
      total: qty > 0 && unit > 0 ? moneyText(item.currency, Math.round(qty * unit)) : "",
    };
  });
  const txnRows: ExportRow[] = txns.map((t) => ({
    reference: t.merchantReference,
    payazaReference: t.payazaReference ?? "",
    channel: channelLabel(t.channel),
    amount: moneyText(t.currency, t.amountMinor),
    fee: moneyText(t.currency, t.feeMinor),
    net: moneyText(t.currency, t.netMinor),
    status: statusText(t.status),
    when: dateTimeText(t.occurredAt ?? t.createdAt),
  }));

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/app/invoices"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Invoices
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-mono text-xl font-semibold tracking-tight">{invoice.number}</h1>
            <StatusBadge status={invoice.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {buyer ? `${buyer.name} · ${buyer.country}` : "Buyer details unavailable"}
            {" · "}
            {invoice.dueAt ? `due ${dateFmt.format(invoice.dueAt)}` : "due on receipt"}
          </p>
          <Amount
            minor={invoice.amountMinor}
            currency={invoice.currency}
            className="text-3xl font-semibold"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <a href={`/api/invoices/${invoice.id}/pdf`} download>
              <FileDown data-icon="inline-start" />
              Download PDF
            </a>
          </Button>
          {canReceipt && (
            <Button variant="outline" asChild>
              <a href={`/api/invoices/${invoice.id}/receipt`} download>
                <ReceiptText data-icon="inline-start" />
                Download Receipt
              </a>
            </Button>
          )}
          {s === "ready" && <SendButton invoiceId={invoice.id} action="send" />}
          {s === "sent" && <SendButton invoiceId={invoice.id} action="resend" />}
          {s === "sent" && <CopyLinkButton token={invoice.token} />}
          {s === "paid" && demoMode && <SimulateSettleButton invoiceId={invoice.id} />}
          {s === "settled" && (
            <PayoutDialog
              invoiceId={invoice.id}
              rails={railOptions}
              netMinor={waterfall.netMinor}
              netCurrency={waterfall.netCurrency}
              demoMode={demoMode}
              walletWarning={null}
            />
          )}
          {canCancel && <CancelButton invoiceId={invoice.id} />}
        </div>
      </div>

      {/* Body: 2/1 split */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="flex flex-col gap-6 md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>
                Everything that has happened on this invoice, oldest first.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Timeline events={events} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
              {itemRows.length > 0 && (
                <CardAction>
                  <ExportMenu
                    title={`Invoice ${invoice.number} Items`}
                    filename={`kusanya-${invoice.number}-items`}
                    subtitle={buyer ? `Billed to ${buyer.name}` : undefined}
                    businessName={business.name}
                    columns={ITEM_COLUMNS}
                    rows={itemRows}
                  />
                </CardAction>
              )}
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No line items — this invoice carries a single total.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const qty = Number(item.qty);
                      const unit = Number(item.unitPriceMinor);
                      const hasBoth = qty > 0 && unit > 0;
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="max-w-96 truncate" title={item.description}>
                            {item.description}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{qty}</TableCell>
                          <TableCell className="text-right">
                            {unit > 0 ? (
                              <Amount minor={unit} currency={item.currency} />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {hasBoth ? (
                              <Amount
                                minor={Math.round(qty * unit)}
                                currency={item.currency}
                                className="font-medium"
                              />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {invoice.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                  {invoice.notes}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Transactions</CardTitle>
              <CardDescription>
                Every movement on this invoice, exactly as Payaza reported it.
              </CardDescription>
              {txnRows.length > 0 && (
                <CardAction>
                  <ExportMenu
                    title={`Invoice ${invoice.number} Transactions`}
                    filename={`kusanya-${invoice.number}-transactions`}
                    businessName={business.name}
                    columns={TXN_COLUMNS}
                    rows={txnRows}
                  />
                </CardAction>
              )}
            </CardHeader>
            <CardContent>
              {txns.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No transactions yet — once the buyer pays, every step appears here.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Fee</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {txns.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <span
                            className="block max-w-40 truncate font-mono text-xs"
                            title={t.merchantReference}
                          >
                            {t.merchantReference}
                          </span>
                        </TableCell>
                        <TableCell>{channelLabel(t.channel)}</TableCell>
                        <TableCell className="text-right">
                          <Amount minor={t.amountMinor} currency={t.currency} />
                        </TableCell>
                        <TableCell className="text-right">
                          {t.feeMinor != null ? (
                            <Amount
                              minor={t.feeMinor}
                              currency={t.currency}
                              className="text-muted-foreground"
                            />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {t.netMinor != null ? (
                            <Amount
                              minor={t.netMinor}
                              currency={t.currency}
                              className="text-muted-foreground"
                            />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={t.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {dateTimeFmt.format(t.occurredAt ?? t.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <WaterfallPanel waterfall={waterfall} />
          <RiskCard
            invoiceId={invoice.id}
            risk={
              risk
                ? {
                    compositeScore: risk.compositeScore,
                    decision: risk.decision,
                    reasons: risk.reasons,
                    fallback: risk.fallback,
                  }
                : undefined
            }
          />
          <RemindersCard invoiceId={invoice.id} reminders={reminderRows} />
          <ReplayPanel
            invoiceId={invoice.id}
            txnRefs={{ collectionRef, payoutRef }}
            demoMode={demoMode}
          />
        </div>
      </div>
    </div>
  );
}

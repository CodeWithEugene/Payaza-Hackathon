import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { ArrowDownLeft, ArrowUpRight, CircleAlert, Coins, Wallet } from "lucide-react";

import { requireBusiness } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { invoices, transactions } from "@/lib/db/schema";
import { getWallets } from "@/lib/services/payouts";
import { CURRENCIES, isCurrency } from "@/lib/money/currencies";
import { Amount } from "@/components/money/amount";
import { StatusBadge } from "@/components/invoices/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExportMenu } from "@/components/export/export-menu";
import { dateTimeText, moneyText, statusText } from "@/lib/export/format";
import type { ExportColumn, ExportRow } from "@/lib/export/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const metadata: Metadata = { title: "Payments" };

type Tab = "all" | "in" | "out";

/** Channel → plain-English label (exactly the rails Kusanya rides on). */
const CHANNEL_LABELS: Record<string, string> = {
  card: "Card (Payaza Checkout)",
  momo_ke: "M-Pesa Kenya",
  momo_ug: "MTN/Airtel Uganda",
  momo_tz: "M-Pesa/Tigo Tanzania",
  mpesa_payout: "M-Pesa payout",
  kepss_payout: "Bank payout (kepss)",
  payment_link: "Payment link",
  // Schema channels outside the MVP label sheet — labeled honestly.
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  virtual_account: "Virtual account",
  manual: "Manual",
};

const LEDGER_COLUMNS: ExportColumn[] = [
  { key: "when", header: "When", nowrap: true },
  { key: "invoice", header: "Invoice", nowrap: true },
  { key: "type", header: "Type" },
  { key: "channel", header: "Channel" },
  { key: "status", header: "Status" },
  { key: "amount", header: "Amount", align: "right" },
  { key: "fee", header: "Fee", align: "right" },
  { key: "net", header: "Net", align: "right" },
  { key: "reference", header: "Reference", nowrap: true },
  { key: "payazaReference", header: "Payaza Reference", nowrap: true },
];

const TAB_TITLES: Record<Tab, string> = { all: "All", in: "Collections", out: "Payouts" };

/** Payaza's accountBalance arrives in MAJOR units; Amount speaks MINOR. */
const MAJOR_DECIMALS: Record<string, number> = { USD: 2, KES: 2, UGX: 0, TZS: 0 };
function walletBalanceToMinor(balance: number, currency: string): number {
  const decimals = MAJOR_DECIMALS[currency] ?? 2;
  return Math.round(balance * 10 ** decimals);
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { business } = await requireBusiness();
  const sp = await searchParams;
  const tab: Tab = sp.tab === "in" || sp.tab === "out" ? sp.tab : "all";

  // Wallets — DEMO_MODE returns fixtures with the live shape; on any error we
  // degrade to a single honest card instead of failing the page.
  let walletRows: Awaited<ReturnType<typeof getWallets>>["data"] = [];
  let walletsFailed = false;
  try {
    const resp = await getWallets(business.id);
    walletRows = resp.data;
  } catch {
    walletsFailed = true;
  }

  const whereClause =
    tab === "all"
      ? eq(transactions.businessId, business.id)
      : and(eq(transactions.businessId, business.id), eq(transactions.direction, tab));

  const ledger = await db
    .select({ txn: transactions, invoiceNumber: invoices.number })
    .from(transactions)
    .leftJoin(invoices, eq(invoices.id, transactions.invoiceId))
    .where(whereClause)
    .orderBy(desc(transactions.createdAt))
    .limit(100);

  const ledgerRows: ExportRow[] = ledger.map(({ txn, invoiceNumber }) => {
    const isOut = txn.direction === "out";
    const signedMinor = isOut ? -Math.abs(Number(txn.amountMinor)) : Number(txn.amountMinor);
    return {
      when: dateTimeText(txn.occurredAt ?? txn.createdAt),
      invoice: invoiceNumber ?? "",
      type: isOut ? "Payout" : "Collection",
      channel: CHANNEL_LABELS[txn.channel] ?? txn.channel,
      status: statusText(txn.status),
      amount: moneyText(txn.currency, signedMinor),
      fee: moneyText(txn.currency, txn.feeMinor),
      net: moneyText(txn.currency, txn.netMinor),
      reference: txn.merchantReference,
      payazaReference: txn.payazaReference ?? "",
    };
  });
  const tabSlug = tab === "all" ? "" : `-${TAB_TITLES[tab].toLowerCase()}`;

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight">Payments</h1>
          <p className="text-sm text-muted-foreground">
            Your Payaza wallets and every shilling in and out: amounts, fees and nets exactly
            as reported.
          </p>
        </div>

        {/* ------------------------------------------------------- wallets -- */}
        {walletsFailed ? (
          <Card>
            <CardContent className="flex items-center gap-3 py-1 text-muted-foreground">
              <Wallet className="size-5 shrink-0" />
              <p className="text-sm">
                Wallets unavailable: Payaza keys not configured (demo fixtures below)
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {walletRows.map((w) => {
              const currencyName = isCurrency(w.currency)
                ? CURRENCIES[w.currency].name
                : w.currency;
              return (
                <Card key={`${w.currency}-${w.payazaAccountReference}`}>
                  <CardHeader>
                    <CardTitle className="font-heading text-3xl font-semibold tracking-tight">
                      {w.currency}
                    </CardTitle>
                    <CardAction>
                      {w.status === "ACTIVE" ? (
                        <Badge variant="secondary">Active</Badge>
                      ) : (
                        <Badge variant="outline">{w.status ?? "Unknown"}</Badge>
                      )}
                    </CardAction>
                    <CardDescription>
                      {w.accountName ?? currencyName} · {currencyName} wallet on Payaza
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">Balance</span>
                      <Amount
                        minor={walletBalanceToMinor(w.accountBalance, w.currency)}
                        currency={w.currency}
                        className="text-2xl font-semibold"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        Account ref{" "}
                        <span className="font-mono text-foreground">{w.payazaAccountReference}</span>
                      </span>
                      {w.productCode ? <span className="font-mono">{w.productCode}</span> : null}
                    </div>
                    {w.postNoDebit ? (
                      <Alert variant="destructive">
                        <CircleAlert />
                        <AlertTitle>Post-No-Debit</AlertTitle>
                        <AlertDescription>
                          Post-No-Debit: this wallet is frozen for payouts. Contact Payaza
                          support.
                        </AlertDescription>
                      </Alert>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* --------------------------------------------------------- tabs --- */}
        <Tabs value={tab}>
          <TabsList>
            <TabsTrigger value="all" asChild>
              <Link href="/app/payments">All</Link>
            </TabsTrigger>
            <TabsTrigger value="in" asChild>
              <Link href="/app/payments?tab=in">Collections</Link>
            </TabsTrigger>
            <TabsTrigger value="out" asChild>
              <Link href="/app/payments?tab=out">Payouts</Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* ------------------------------------------------------- ledger --- */}
        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-4 py-3">
            <CardTitle>Ledger</CardTitle>
            <CardDescription>
              Last 100 {tab === "in" ? "collections" : tab === "out" ? "payouts" : "transactions"}{" "}
              · newest first
            </CardDescription>
            <CardAction>
              <ExportMenu
                title="Payments Ledger"
                filename={`kusanya-payments${tabSlug}`}
                subtitle={`${TAB_TITLES[tab]} · last 100, newest first`}
                businessName={business.name}
                columns={LEDGER_COLUMNS}
                rows={ledgerRows}
              />
            </CardAction>
          </CardHeader>
          <CardContent className="p-0">
            {ledger.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Coins />
                  </EmptyMedia>
                  <EmptyTitle>
                    No {tab === "in" ? "Collections" : tab === "out" ? "Payouts" : "Transactions"}{" "}
                    Yet
                  </EmptyTitle>
                  <EmptyDescription>
                    When money moves on your invoices it lands here: every amount, fee, net and
                    reference exactly as Payaza reports it.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Fee</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map(({ txn, invoiceNumber }) => {
                    const when = txn.occurredAt ?? txn.createdAt;
                    const isOut = txn.direction === "out";
                    const TypeIcon = isOut ? ArrowUpRight : ArrowDownLeft;
                    return (
                      <TableRow key={txn.id}>
                        <TableCell>
                          <div className="flex flex-col leading-tight">
                            <span className="text-xs">
                              {when.toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {when.toLocaleTimeString("en-GB", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {txn.invoiceId && invoiceNumber ? (
                            <Link
                              href={`/app/invoices/${txn.invoiceId}`}
                              className="font-mono text-xs underline-offset-4 hover:underline"
                            >
                              {invoiceNumber}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TypeIcon
                              className="size-4 shrink-0 text-muted-foreground"
                              aria-hidden
                            />
                            <div className="flex flex-col leading-tight">
                              <span className="text-sm">{isOut ? "Payout" : "Collection"}</span>
                              <span className="text-xs text-muted-foreground">
                                {CHANNEL_LABELS[txn.channel] ?? txn.channel}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={txn.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Amount
                            minor={
                              isOut
                                ? -Math.abs(Number(txn.amountMinor))
                                : Number(txn.amountMinor)
                            }
                            currency={txn.currency}
                            signed={isOut}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {txn.feeMinor != null ? (
                            <Amount minor={txn.feeMinor} currency={txn.currency} />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {txn.netMinor != null ? (
                            <Amount minor={txn.netMinor} currency={txn.currency} />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block max-w-[10rem] truncate font-mono text-xs text-muted-foreground">
                                {txn.merchantReference}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="start">
                              <span className="font-mono">{txn.merchantReference}</span>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

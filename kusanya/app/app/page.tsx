import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  ArrowDownToLine,
  CreditCard,
  FileText,
  Plus,
  ShieldAlert,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { requireBusiness } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { invoices, payouts, transactions } from "@/lib/db/schema";
import { listInvoices } from "@/lib/services/invoices";
import { Amount } from "@/components/money/amount";
import { StatusBadge } from "@/components/invoices/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

/** Tiny server-side relative time — no dependency, deterministic per render. */
function relTime(at: Date | null): string {
  if (!at) return "";
  const seconds = Math.floor((Date.now() - at.getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(at);
}

function channelIcon(txn: { kind: string; channel: string }): LucideIcon {
  if (txn.kind === "payout" || txn.channel.endsWith("_payout")) return ArrowDownToLine;
  if (txn.channel.startsWith("momo_")) return Smartphone;
  return CreditCard;
}

export default async function DashboardPage() {
  const { business } = await requireBusiness();
  const businessId = business.id;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [outstandingByCurrency, awaitingRow, paidOutRow, reviewRow, motion, activity] =
    await Promise.all([
      // Outstanding: sent + partially_paid, grouped by currency — mixed
      // currencies are NEVER summed into one number (contract §5 honesty).
      db
        .select({
          currency: invoices.currency,
          count: sql<number>`count(*)::int`,
          totalMinor: sql<string>`coalesce(sum(${invoices.amountMinor}), '0')`,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.businessId, businessId),
            inArray(invoices.status, ["sent", "partially_paid"]),
          ),
        )
        .groupBy(invoices.currency),
      // Awaiting payout: money collected, not yet in your hands.
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(invoices)
        .where(
          and(
            eq(invoices.businessId, businessId),
            inArray(invoices.status, ["paid", "settling", "settled"]),
          ),
        ),
      // Paid out this month: completed KES payouts.
      db
        .select({ totalMinor: sql<string>`coalesce(sum(${payouts.amountMinorKes}), '0')` })
        .from(payouts)
        .innerJoin(transactions, eq(transactions.id, payouts.transactionId))
        .where(
          and(
            eq(transactions.businessId, businessId),
            eq(transactions.kind, "payout"),
            eq(payouts.status, "completed"),
            gte(payouts.createdAt, monthStart),
          ),
        ),
      // Needs review: risk queue depth.
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(invoices)
        .where(
          and(
            eq(invoices.businessId, businessId),
            inArray(invoices.status, ["review", "on_hold"]),
          ),
        ),
      // Money in motion: invoices in active states, newest first.
      listInvoices(businessId, {
        status: ["sent", "partially_paid", "paid", "settling", "settled", "paying_out"],
        pageSize: 6,
      }),
      // Recent activity: last 8 transactions with their invoice number.
      db
        .select({ txn: transactions, invoiceNumber: invoices.number })
        .from(transactions)
        .leftJoin(invoices, eq(invoices.id, transactions.invoiceId))
        .where(eq(transactions.businessId, businessId))
        .orderBy(desc(transactions.createdAt))
        .limit(8),
    ]);

  const outstandingCount = outstandingByCurrency.reduce((n, r) => n + Number(r.count), 0);
  const awaitingCount = Number(awaitingRow[0]?.count ?? 0);
  const paidOutMinor = paidOutRow[0]?.totalMinor ?? "0";
  const reviewCount = Number(reviewRow[0]?.count ?? 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Header + quick actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Your collections, settlements, and payouts at a glance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {reviewCount > 0 && (
            <Button variant="outline" asChild>
              <Link href="/app/review">
                <ShieldAlert data-icon="inline-start" />
                View risk queue
              </Link>
            </Button>
          )}
          <Button asChild>
            <Link href="/app/invoices/new">
              <Plus data-icon="inline-start" />
              New invoice
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Outstanding</CardTitle>
            <CardDescription>open invoices, across currencies</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tabular-nums">{outstandingCount}</div>
            {outstandingByCurrency.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1">
                {outstandingByCurrency.map((row) => (
                  <li
                    key={row.currency}
                    className="flex items-baseline gap-1.5 text-xs text-muted-foreground"
                  >
                    <Amount
                      minor={row.totalMinor}
                      currency={row.currency}
                      className="text-xs font-medium text-foreground"
                    />
                    <span>
                      in {Number(row.count)} {Number(row.count) === 1 ? "invoice" : "invoices"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Nothing outstanding — every sent invoice has been paid.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Awaiting payout</CardTitle>
            <CardDescription>paid, settling, or settled</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tabular-nums">{awaitingCount}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {awaitingCount > 0
                ? "Payout unlocks the moment funds land in your wallet."
                : "No payouts waiting right now."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Paid out this month</CardTitle>
            <CardDescription>completed payouts to your rails</CardDescription>
          </CardHeader>
          <CardContent>
            <Amount
              minor={paidOutMinor}
              currency="KES"
              className="text-3xl font-semibold"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {Number(paidOutMinor) > 0
                ? "Money that reached your rails since the 1st."
                : "Nothing paid out yet this month."}
            </p>
          </CardContent>
        </Card>

        <Link href="/app/review" className="group flex">
          <Card className="w-full transition-colors group-hover:bg-muted/50">
            <CardHeader>
              <CardTitle>Needs review</CardTitle>
              <CardDescription>flagged by risk screening</CardDescription>
              <CardAction>
                <Badge variant={reviewCount > 0 ? "destructive" : "secondary"}>
                  {reviewCount}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {reviewCount > 0
                  ? `Waiting for your decision — open the risk queue.`
                  : "All clear — nothing flagged right now."}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Two columns: money in motion + recent activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Money in motion</CardTitle>
            <CardDescription>
              Invoices being collected, settled, or paid out right now.
            </CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/app/invoices">View all</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {motion.rows.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileText />
                  </EmptyMedia>
                  <EmptyTitle>Nothing in motion</EmptyTitle>
                  <EmptyDescription>
                    Send an invoice and it will show up here while the money moves.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button asChild>
                    <Link href="/app/invoices/new">
                      <Plus data-icon="inline-start" />
                      New invoice
                    </Link>
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {motion.rows.map(({ invoice, buyerName }) => (
                  <a
                    key={invoice.id}
                    href={`/app/invoices/${invoice.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-mono text-sm">{invoice.number}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {buyerName}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Amount
                        minor={invoice.amountMinor}
                        currency={invoice.currency}
                        className="text-sm"
                      />
                      <StatusBadge status={invoice.status} />
                    </div>
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>
              The latest movements across your transactions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CreditCard />
                  </EmptyMedia>
                  <EmptyTitle>No activity yet</EmptyTitle>
                  <EmptyDescription>
                    Payments, mobile-money collections, and payouts will appear here
                    the moment they happen.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {activity.map(({ txn, invoiceNumber }) => {
                  const Icon = channelIcon(txn);
                  const failed = txn.status === "failed";
                  return (
                    <div key={txn.id} className="flex items-center gap-3 py-2.5">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                        <Icon className="size-4" />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex min-w-0 items-baseline gap-2">
                          {invoiceNumber && txn.invoiceId ? (
                            <a
                              href={`/app/invoices/${txn.invoiceId}`}
                              className="truncate font-mono text-sm hover:underline"
                            >
                              {invoiceNumber}
                            </a>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Standalone transaction
                            </span>
                          )}
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {relTime(txn.occurredAt ?? txn.createdAt)}
                          </span>
                        </div>
                        <StatusBadge status={txn.status} />
                      </div>
                      <span
                        className={cn(
                          "flex shrink-0 items-baseline gap-0.5 text-sm",
                          failed && "text-destructive",
                        )}
                      >
                        {txn.direction === "out" && <span aria-hidden="true">−</span>}
                        <Amount minor={txn.amountMinor} currency={txn.currency} />
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

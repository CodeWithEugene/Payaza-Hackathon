import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import {
  CheckCircle2,
  HandCoins,
  ListChecks,
  Percent,
  Timer,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { requireBusiness } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { buyers, invoices, transactions } from "@/lib/db/schema";
import { CURRENCY_CODES, isCurrency, minorFactor, type CurrencyCode } from "@/lib/money/currencies";
import { statusLabel } from "@/components/invoices/status-badge";
import { Amount } from "@/components/money/amount";
import {
  ChannelPieChart,
  CollectionsAreaChart,
  StatusBarChart,
  type ChannelPoint,
  type DailyPoint,
  type StatusPoint,
} from "@/components/analytics/charts";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ChartConfig } from "@/components/ui/chart";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ChartExportMenu } from "@/components/export/chart-export-menu";
import { ExportMenu } from "@/components/export/export-menu";
import { ReportButton } from "@/components/export/report-button";
import { dateText, moneyText } from "@/lib/export/format";
import type { ExportColumn, ExportKpi, ExportRow, ExportTable } from "@/lib/export/types";

export const metadata: Metadata = { title: "Analytics" };

/** DOM ids the chart export menus and the report rasterize from. */
const CHART_IDS = {
  collections: "chart-collections",
  channels: "chart-channels",
  status: "chart-status",
} as const;

const TOP_BUYER_COLUMNS: ExportColumn[] = [
  { key: "rank", header: "Rank", align: "right" },
  { key: "buyer", header: "Buyer" },
  { key: "collections", header: "Completed Collections", align: "right" },
  { key: "collected", header: "Collected (Per Currency)", align: "right" },
];

const CHANNEL_COLUMNS: ExportColumn[] = [
  { key: "channel", header: "Channel" },
  { key: "count", header: "Completed Collections", align: "right" },
];

const STATUS_COLUMNS: ExportColumn[] = [
  { key: "status", header: "Status" },
  { key: "count", header: "Invoices", align: "right" },
];

/** Channel → plain-English label (same sheet as the payments ledger). */
const CHANNEL_LABELS: Record<string, string> = {
  card: "Card (Payaza Checkout)",
  momo_ke: "M-Pesa Kenya",
  momo_ug: "MTN/Airtel Uganda",
  momo_tz: "M-Pesa/Tigo Tanzania",
  mpesa_payout: "M-Pesa payout",
  kepss_payout: "Bank payout (kepss)",
  payment_link: "Payment link",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  virtual_account: "Virtual account",
  manual: "Manual",
};

/** Lifecycle order for the status chart — honest, stable reading order. */
const STATUS_ORDER = [
  "draft",
  "ready",
  "sent",
  "partially_paid",
  "paid",
  "settling",
  "settled",
  "paying_out",
  "completed",
  "failed",
  "cancelled",
  "review",
  "on_hold",
];

/** Chart series colors — only ever var(--chart-1..5) via chartConfig. */
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 45;

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ currency?: string }>;
}) {
  const { business } = await requireBusiness();
  const sp = await searchParams;
  const requested = typeof sp.currency === "string" ? sp.currency.toUpperCase() : "";
  const currency: CurrencyCode = isCurrency(requested) ? requested : "USD";
  const factor = minorFactor(currency);

  // -------------------------------------------------- (a) daily collections --
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windowStart = new Date(today);
  windowStart.setDate(windowStart.getDate() - (WINDOW_DAYS - 1));

  const collectionTxns = await db
    .select({
      occurredAt: transactions.occurredAt,
      amountMinor: transactions.amountMinor,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.businessId, business.id),
        eq(transactions.kind, "collection"),
        eq(transactions.direction, "in"),
        eq(transactions.status, "completed"),
        eq(transactions.currency, currency),
        isNotNull(transactions.occurredAt),
        gte(transactions.occurredAt, windowStart),
      ),
    );

  const buckets = new Map<string, number>();
  for (const t of collectionTxns) {
    if (!t.occurredAt) continue;
    const key = dayKey(t.occurredAt);
    buckets.set(key, (buckets.get(key) ?? 0) + Math.round(Number(t.amountMinor)));
  }
  const series: DailyPoint[] = [];
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const d = new Date(windowStart);
    d.setDate(windowStart.getDate() + i);
    const minor = buckets.get(dayKey(d)) ?? 0;
    series.push({
      day: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      minor,
      total: minor / factor, // display-only major units for the chart coordinate
    });
  }
  const collectedMinor = series.reduce((s, p) => s + p.minor, 0);
  const hasCollections = series.some((p) => p.minor > 0);

  // ------------------------------------------------------ (b) channel mix ----
  const channelRows = await db
    .select({ channel: transactions.channel, count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(
      and(
        eq(transactions.businessId, business.id),
        eq(transactions.kind, "collection"),
        eq(transactions.direction, "in"),
        eq(transactions.status, "completed"),
      ),
    )
    .groupBy(transactions.channel);

  const pieData: ChannelPoint[] = channelRows
    .map((r) => ({ channel: r.channel, count: Number(r.count) }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count || a.channel.localeCompare(b.channel));
  const completedTotal = pieData.reduce((s, r) => s + r.count, 0);

  const pieConfig: ChartConfig = {};
  pieData.forEach((d, i) => {
    pieConfig[d.channel] = {
      label: CHANNEL_LABELS[d.channel] ?? d.channel,
      color: CHART_COLORS[i % CHART_COLORS.length],
    };
  });

  // ---------------------------------------------------- (c) invoice status ---
  const statusRows = await db
    .select({ status: invoices.status, count: sql<number>`count(*)::int` })
    .from(invoices)
    .where(eq(invoices.businessId, business.id))
    .groupBy(invoices.status);

  const statusCounts = new Map(
    statusRows.map((r): [string, number] => [r.status, Number(r.count)]),
  );
  const statusData: StatusPoint[] = STATUS_ORDER.filter((s) => (statusCounts.get(s) ?? 0) > 0).map(
    (s) => ({ status: s, label: statusLabel(s), count: statusCounts.get(s) ?? 0 }),
  );
  const invoiceTotal = statusData.reduce((s, r) => s + r.count, 0);

  const barConfig: ChartConfig = {
    count: { label: "Invoices", color: "var(--chart-2)" },
  };

  // ------------------------------------------------------------- (d) KPIs ----
  // Avg days issued → paid: completed collection occurredAt − invoice issuedAt.
  const paidJoin = await db
    .select({ issuedAt: invoices.issuedAt, occurredAt: transactions.occurredAt })
    .from(transactions)
    .innerJoin(invoices, eq(invoices.id, transactions.invoiceId))
    .where(
      and(
        eq(transactions.businessId, business.id),
        eq(transactions.kind, "collection"),
        eq(transactions.direction, "in"),
        eq(transactions.status, "completed"),
        isNotNull(invoices.issuedAt),
        isNotNull(transactions.occurredAt),
      ),
    );
  const dayDiffs = paidJoin.flatMap((r) =>
    r.issuedAt && r.occurredAt
      ? [(r.occurredAt.getTime() - r.issuedAt.getTime()) / DAY_MS]
      : [],
  ).filter((d) => d >= 0);
  const avgDays =
    dayDiffs.length > 0
      ? (dayDiffs.reduce((s, d) => s + d, 0) / dayDiffs.length).toFixed(1)
      : null;

  // Collection success rate: completed / (completed + failed) collection txns.
  const outcomeRows = await db
    .select({ status: transactions.status, count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(
      and(
        eq(transactions.businessId, business.id),
        eq(transactions.kind, "collection"),
        inArray(transactions.status, ["completed", "failed"]),
      ),
    )
    .groupBy(transactions.status);
  const completedN = outcomeRows.find((r) => r.status === "completed")?.count ?? 0;
  const failedN = outcomeRows.find((r) => r.status === "failed")?.count ?? 0;
  const successRate =
    completedN + failedN > 0 ? ((completedN / (completedN + failedN)) * 100).toFixed(1) : null;

  // Top buyers — ranked by COUNT (currency-neutral); totals shown per currency.
  const buyerRows = await db
    .select({
      buyerId: buyers.id,
      buyerName: buyers.name,
      currency: transactions.currency,
      count: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${transactions.amountMinor}), '0')`,
    })
    .from(transactions)
    .innerJoin(invoices, eq(invoices.id, transactions.invoiceId))
    .innerJoin(buyers, eq(buyers.id, invoices.buyerId))
    .where(
      and(
        eq(transactions.businessId, business.id),
        eq(transactions.kind, "collection"),
        eq(transactions.direction, "in"),
        eq(transactions.status, "completed"),
      ),
    )
    .groupBy(buyers.id, buyers.name, transactions.currency)
    .orderBy(desc(sql`count(*)::int`));

  interface BuyerAgg {
    buyerId: string;
    buyerName: string;
    collections: number;
    byCurrency: { currency: string; totalMinor: number }[];
  }
  const buyerMap = new Map<string, BuyerAgg>();
  for (const r of buyerRows) {
    const agg =
      buyerMap.get(r.buyerId) ??
      ({ buyerId: r.buyerId, buyerName: r.buyerName, collections: 0, byCurrency: [] } as BuyerAgg);
    agg.collections += Number(r.count);
    const minor = Math.round(Number(r.total));
    const cur = agg.byCurrency.find((c) => c.currency === r.currency);
    if (cur) cur.totalMinor += minor;
    else agg.byCurrency.push({ currency: r.currency, totalMinor: minor });
    buyerMap.set(r.buyerId, agg);
  }
  const topBuyers = [...buyerMap.values()]
    .sort((a, b) => b.collections - a.collections || a.buyerName.localeCompare(b.buyerName))
    .slice(0, 5);

  const areaConfig: ChartConfig = {
    total: { label: `Collected (${currency})`, color: "var(--chart-1)" },
  };
  const windowLabel = windowStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  // ------------------------------------------------------------ exports --
  const topBuyerRows: ExportRow[] = topBuyers.map((b, i) => ({
    rank: String(i + 1),
    buyer: b.buyerName,
    collections: String(b.collections),
    collected: b.byCurrency.map((c) => moneyText(c.currency, c.totalMinor)).join("; "),
  }));
  const channelExportRows: ExportRow[] = pieData.map((d) => ({
    channel: CHANNEL_LABELS[d.channel] ?? d.channel,
    count: String(d.count),
  }));
  const statusExportRows: ExportRow[] = statusData.map((d) => ({
    status: d.label.replace(/^Imefika! /, ""),
    count: String(d.count),
  }));
  const rangeLabel = `${dateText(windowStart)} to ${dateText(today)}`;
  const reportKpis: ExportKpi[] = [
    {
      label: `Collected (${currency}, last ${WINDOW_DAYS} days)`,
      value: moneyText(currency, collectedMinor),
      hint: "Gross of completed collections, before fees and splits",
    },
    {
      label: "Avg. Issued To Paid",
      value: avgDays !== null ? `${avgDays} days` : "Not enough data",
      hint: `${dayDiffs.length} completed collections, all currencies`,
    },
    {
      label: "Collection Success Rate",
      value: successRate !== null ? `${successRate}%` : "Not enough data",
      hint: `${completedN} completed vs ${failedN} failed attempts`,
    },
    {
      label: "Completed Collections",
      value: completedTotal.toLocaleString("en-KE"),
      hint: "All currencies, all time",
    },
  ];
  const reportTables: ExportTable[] = [
    { title: "Top Buyers", columns: TOP_BUYER_COLUMNS, rows: topBuyerRows },
    { title: "Channel Mix", columns: CHANNEL_COLUMNS, rows: channelExportRows },
    { title: "Invoices By Status", columns: STATUS_COLUMNS, rows: statusExportRows },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* --------------------------------------------------------- header -- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Honest numbers only: one currency at a time, real zeros, nothing smoothed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReportButton
            title="Analytics Report"
            filename={`kusanya-analytics-report-${currency.toLowerCase()}`}
            businessName={business.name}
            rangeLabel={rangeLabel}
            kpis={reportKpis}
            tables={reportTables}
            charts={[
              {
                targetId: CHART_IDS.collections,
                title: `Completed Collections (${currency}, Last ${WINDOW_DAYS} Days)`,
                description: "Daily gross totals. Days without a completed collection show a real zero.",
              },
              {
                targetId: CHART_IDS.channels,
                title: "Channel Mix",
                description: "Completed collections per channel, all currencies, all time.",
              },
              {
                targetId: CHART_IDS.status,
                title: "Invoices By Status",
                description: "Every invoice on the books right now, counted once each.",
              },
            ]}
            notes={[
              `Collections figures cover ${rangeLabel} in ${currency}. Channel mix, status and top buyers are all time.`,
              "Amounts are never summed across currencies.",
            ]}
          />
          <span className="text-xs text-muted-foreground">Collections currency</span>
          <ToggleGroup type="single" variant="outline" size="sm" value={currency}>
            {CURRENCY_CODES.map((c) => (
              <ToggleGroupItem key={c} value={c} asChild>
                <Link href={`/app/analytics?currency=${c}`}>{c}</Link>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {/* ----------------------------------------------------------- KPIs -- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardDescription>
              Collected · {currency} · last {WINDOW_DAYS} days
            </CardDescription>
            <CardTitle className="font-heading text-2xl font-semibold tracking-tight">
              <Amount minor={collectedMinor} currency={currency} />
            </CardTitle>
            <CardAction>
              <HandCoins className="size-4 text-muted-foreground" aria-hidden />
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Gross of completed {currency} collections since {windowLabel}. Fees and splits
              are not deducted.
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>Avg. issued → paid</CardDescription>
            <CardTitle className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
              {avgDays !== null ? `${avgDays} days` : "—"}
            </CardTitle>
            <CardAction>
              <Timer className="size-4 text-muted-foreground" aria-hidden />
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {dayDiffs.length > 0
                ? `Mean across ${dayDiffs.length} completed collection${dayDiffs.length === 1 ? "" : "s"} · all currencies.`
                : "No completed collections yet."}
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>Collection success rate</CardDescription>
            <CardTitle className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
              {successRate !== null ? `${successRate}%` : "—"}
            </CardTitle>
            <CardAction>
              <Percent className="size-4 text-muted-foreground" aria-hidden />
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {completedN + failedN > 0
                ? `${completedN} completed vs ${failedN} failed attempts · all currencies.`
                : "No completed or failed attempts yet."}
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>Completed collections</CardDescription>
            <CardTitle className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
              {completedTotal.toLocaleString("en-KE")}
            </CardTitle>
            <CardAction>
              <CheckCircle2 className="size-4 text-muted-foreground" aria-hidden />
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              All currencies · all time. Pending and failed attempts are not counted.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------------------- area chart -- */}
      <Card>
        <CardHeader>
          <CardTitle>Completed Collections · {currency} · Last {WINDOW_DAYS} Days</CardTitle>
          <CardDescription>
            Daily gross totals of completed {currency} collections. Days without a completed
            collection show a real zero, and nothing is interpolated.
          </CardDescription>
          <CardAction className="flex items-center gap-2">
            <Badge variant="secondary">{currency}</Badge>
            {hasCollections && (
              <ChartExportMenu
                targetId={CHART_IDS.collections}
                title={`Completed Collections (${currency}, Last ${WINDOW_DAYS} Days)`}
                filename={`kusanya-collections-${currency.toLowerCase()}`}
              />
            )}
          </CardAction>
        </CardHeader>
        <CardContent>
          {hasCollections ? (
            <div id={CHART_IDS.collections}>
              <CollectionsAreaChart data={series} config={areaConfig} currency={currency} />
            </div>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <TrendingUp />
                </EmptyMedia>
                <EmptyTitle>No Completed {currency} Collections In This Window</EmptyTitle>
                <EmptyDescription>
                  When a {currency} invoice is paid through Payaza, its daily total appears
                  here. Try another currency above.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>

      {/* --------------------------------------------------- pie + bar grid -- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Channel Mix · Completed Collections</CardTitle>
            <CardDescription>
              How many completed collections rode each channel, all currencies together.
              Counts are currency-neutral; amounts are never summed across currencies.
            </CardDescription>
            {pieData.length > 0 && (
              <CardAction>
                <ChartExportMenu
                  targetId={CHART_IDS.channels}
                  title="Channel Mix"
                  filename="kusanya-channel-mix"
                />
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div id={CHART_IDS.channels}>
                <ChannelPieChart data={pieData} config={pieConfig} />
              </div>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Wallet />
                  </EmptyMedia>
                  <EmptyTitle>No Completed Collections Yet</EmptyTitle>
                  <EmptyDescription>
                    Card, M-Pesa, MTN… once collections complete, the mix shows up here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoices By Status</CardTitle>
            <CardDescription>
              Every invoice on the books right now: {invoiceTotal.toLocaleString("en-KE")}{" "}
              total, counted once each.
            </CardDescription>
            {statusData.length > 0 && (
              <CardAction>
                <ChartExportMenu
                  targetId={CHART_IDS.status}
                  title="Invoices By Status"
                  filename="kusanya-invoices-by-status"
                />
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <div id={CHART_IDS.status}>
                <StatusBarChart data={statusData} config={barConfig} />
              </div>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ListChecks />
                  </EmptyMedia>
                  <EmptyTitle>No Invoices Yet</EmptyTitle>
                  <EmptyDescription>
                    Create your first invoice and its journey through the statuses will be
                    charted here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ----------------------------------------------------- top buyers -- */}
      <Card className="gap-0 py-0">
        <CardHeader className="border-b px-4 py-3">
          <CardTitle>Top Buyers · Completed Collections</CardTitle>
          <CardDescription>
            Ranked by number of completed collections. Totals are shown per currency and never
            summed across currencies.
          </CardDescription>
          {topBuyers.length > 0 && (
            <CardAction>
              <ExportMenu
                title="Top Buyers"
                filename="kusanya-top-buyers"
                subtitle="Ranked by completed collections, all time"
                businessName={business.name}
                columns={TOP_BUYER_COLUMNS}
                rows={topBuyerRows}
              />
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {topBuyers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-muted-foreground">#</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead className="text-right">Completed collections</TableHead>
                  <TableHead className="text-right">Collected (per currency)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topBuyers.map((b, i) => (
                  <TableRow key={b.buyerId}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {i + 1}
                    </TableCell>
                    <TableCell className="font-medium">{b.buyerName}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {b.collections.toLocaleString("en-KE")}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-end gap-0.5">
                        {b.byCurrency.map((c) => (
                          <Amount key={c.currency} minor={c.totalMinor} currency={c.currency} />
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users />
                </EmptyMedia>
                <EmptyTitle>No Completed Collections Yet</EmptyTitle>
                <EmptyDescription>
                  Your most reliable buyers will be ranked here once their invoices are paid.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

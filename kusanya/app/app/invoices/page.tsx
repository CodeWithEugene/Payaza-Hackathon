import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, FileText, Plus, Search } from "lucide-react";
import { requireBusiness } from "@/lib/auth/guards";
import { listInvoices } from "@/lib/services/invoices";
import type { Invoice } from "@/lib/db/schema";
import { Amount } from "@/components/money/amount";
import { StatusBadge } from "@/components/invoices/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata: Metadata = { title: "Invoices" };

interface TabDef {
  key: string;
  label: string;
  statuses: Invoice["status"][] | undefined;
}

const TABS: TabDef[] = [
  { key: "all", label: "All", statuses: undefined },
  { key: "unpaid", label: "Unpaid", statuses: ["sent", "partially_paid"] },
  { key: "paid", label: "Paid", statuses: ["paid", "settling", "settled", "paying_out"] },
  { key: "completed", label: "Completed", statuses: ["completed"] },
  { key: "flagged", label: "Flagged", statuses: ["review", "on_hold"] },
  { key: "closed", label: "Cancelled + Failed", statuses: ["cancelled", "failed"] },
];

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const { business } = await requireBusiness();

  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const tab = TABS.find((t) => t.key === sp.status) ?? TABS[0];
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const filtering = q.length > 0 || tab.key !== "all";

  const { rows, total, pageSize } = await listInvoices(business.id, {
    q: q || undefined,
    status: tab.statuses,
    page,
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function hrefWith(overrides: { q?: string; status?: string; page?: number }): string {
    const params = new URLSearchParams();
    const nextQ = overrides.q !== undefined ? overrides.q : q;
    const nextStatus = overrides.status !== undefined ? overrides.status : tab.key;
    const nextPage = overrides.page ?? 1;
    if (nextQ) params.set("q", nextQ);
    if (nextStatus && nextStatus !== "all") params.set("status", nextStatus);
    if (nextPage > 1) params.set("page", String(nextPage));
    const s = params.toString();
    return s ? `/app/invoices?${s}` : "/app/invoices";
  }

  const now = Date.now();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Every invoice you&apos;ve created, newest first.
          </p>
        </div>
        <Button asChild>
          <Link href="/app/invoices/new">
            <Plus data-icon="inline-start" />
            New invoice
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <form method="get" action="/app/invoices" className="flex flex-wrap items-center gap-2">
          {tab.key !== "all" && <input type="hidden" name="status" value={tab.key} />}
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search by invoice number or buyer…"
            aria-label="Search invoices"
            className="max-w-sm"
          />
          <Button type="submit" variant="outline">
            <Search data-icon="inline-start" />
            Search
          </Button>
        </form>

        <div className="w-full overflow-x-auto">
          <Tabs value={tab.key}>
            <TabsList>
              {TABS.map((t) => (
                <TabsTrigger key={t.key} value={t.key} asChild>
                  <a href={hrefWith({ status: t.key })}>{t.label}</a>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyTitle>
              {filtering ? "No invoices match" : "No invoices yet"}
            </EmptyTitle>
            <EmptyDescription>
              {filtering
                ? "Try a different search term, or clear the filters to see everything."
                : "Snap or paste an invoice, review what the AI extracted, and send it to your buyer in minutes."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {filtering ? (
              <Button variant="outline" asChild>
                <Link href="/app/invoices">Clear filters</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/app/invoices/new">
                  <Plus data-icon="inline-start" />
                  New invoice
                </Link>
              </Button>
            )}
          </EmptyContent>
        </Empty>
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ invoice, buyerName, buyerCountry, paidMinor }) => {
                  const paid = Number(paidMinor);
                  const amount = Number(invoice.amountMinor);
                  const unpaid = invoice.status === "sent" || invoice.status === "partially_paid";
                  const overdue =
                    unpaid && invoice.dueAt !== null && invoice.dueAt.getTime() < now;
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <a
                          href={`/app/invoices/${invoice.id}`}
                          className="font-mono text-sm hover:underline"
                        >
                          {invoice.number}
                        </a>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="max-w-48 truncate">{buyerName}</span>
                          <span className="text-xs text-muted-foreground">{buyerCountry}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {invoice.issuedAt ? dateFmt.format(invoice.issuedAt) : "—"}
                      </TableCell>
                      <TableCell>
                        {invoice.dueAt ? (
                          <div className="flex flex-col">
                            <span>{dateFmt.format(invoice.dueAt)}</span>
                            {overdue && (
                              <span className="text-xs font-medium text-destructive">overdue</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">On receipt</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Amount minor={invoice.amountMinor} currency={invoice.currency} />
                      </TableCell>
                      <TableCell className="text-right">
                        {paid > 0 && paid < amount ? (
                          <Amount
                            minor={paid}
                            currency={invoice.currency}
                            className="text-muted-foreground"
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={invoice.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages} · {total} {total === 1 ? "invoice" : "invoices"}
            </span>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={hrefWith({ page: page - 1 })}>
                    <ChevronLeft data-icon="inline-start" />
                    Previous
                  </a>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  <ChevronLeft data-icon="inline-start" />
                  Previous
                </Button>
              )}
              {page < totalPages ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={hrefWith({ page: page + 1 })}>
                    Next
                    <ChevronRight data-icon="inline-end" />
                  </a>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Next
                  <ChevronRight data-icon="inline-end" />
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

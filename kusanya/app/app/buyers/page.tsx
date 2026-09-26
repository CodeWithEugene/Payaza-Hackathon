import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { Contact, Plus } from "lucide-react";

import { requireBusiness } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { buyers, invoices, transactions } from "@/lib/db/schema";
import { Amount } from "@/components/money/amount";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
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

export const metadata: Metadata = { title: "Buyers" };

/** riskFlags is jsonb — render defensively, strings only. */
function flagList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string" && x.length > 0);
}

/** Buyer directory with invoice counts + collected totals (per currency). */
export default async function BuyersPage() {
  const { business } = await requireBusiness();

  const buyerRows = await db
    .select()
    .from(buyers)
    .where(eq(buyers.businessId, business.id))
    .orderBy(desc(buyers.createdAt));

  const countRows = await db
    .select({
      buyerId: invoices.buyerId,
      n: sql<number>`count(*)`,
    })
    .from(invoices)
    .where(eq(invoices.businessId, business.id))
    .groupBy(invoices.buyerId);

  // Completed collections per buyer + currency (mixed-currency — never sum
  // across currencies; show a breakdown instead).
  const collectedRows = await db
    .select({
      buyerId: invoices.buyerId,
      currency: transactions.currency,
      total: sql<string>`sum(${transactions.amountMinor})`,
    })
    .from(transactions)
    .innerJoin(invoices, eq(invoices.id, transactions.invoiceId))
    .where(
      and(
        eq(invoices.businessId, business.id),
        eq(transactions.kind, "collection"),
        eq(transactions.status, "completed"),
      ),
    )
    .groupBy(invoices.buyerId, transactions.currency);

  const counts = new Map<string, number>();
  for (const r of countRows) counts.set(r.buyerId, Number(r.n));

  const collected = new Map<string, { currency: string; minor: number }[]>();
  for (const r of collectedRows) {
    const list = collected.get(r.buyerId) ?? [];
    list.push({ currency: r.currency, minor: Math.round(Number(r.total)) });
    collected.set(r.buyerId, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Buyers
        </h1>
        <p className="text-sm text-muted-foreground">
          Everyone you invoice — matched automatically from your messages or
          added by hand.
        </p>
      </header>

      {buyerRows.length === 0 ? (
        <Empty className="border border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Contact />
            </EmptyMedia>
            <EmptyTitle>No buyers yet</EmptyTitle>
            <EmptyDescription>
              Buyers appear here after your first invoice — Jev matches names in
              the messages you paste against this directory.
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
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                  <TableHead>Collected</TableHead>
                  <TableHead>Risk flags</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buyerRows.map((b) => {
                  const totals = collected.get(b.id) ?? [];
                  const flags = flagList(b.riskFlags);
                  return (
                    <TableRow key={b.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{b.name}</span>
                          <Badge variant="outline">
                            {b.kind === "company" ? "Company" : "Person"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {b.country}
                      </TableCell>
                      <TableCell>
                        {b.email ? (
                          <a
                            href={`mailto:${b.email}`}
                            className="underline-offset-4 hover:underline"
                          >
                            {b.email}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {b.phone ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {counts.get(b.id) ?? 0}
                      </TableCell>
                      <TableCell>
                        {totals.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            {totals.map((t) => (
                              <Amount
                                key={t.currency}
                                minor={t.minor}
                                currency={t.currency}
                                className="text-xs"
                              />
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {flags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {flags.map((f) => (
                              <Badge key={f} variant="destructive">
                                {f}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {b.createdAt.toLocaleDateString("en-KE", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

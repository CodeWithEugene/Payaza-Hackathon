import type { Metadata } from "next";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ChevronDown, Info, Landmark, Receipt, Smartphone, Users } from "lucide-react";

import { requireBusiness } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { buyers, invoices } from "@/lib/db/schema";
import { listPartners, partnerStatement } from "@/lib/services/splits";
import { bankCodes } from "@/lib/payaza/endpoints";
import { StatusBadge } from "@/components/invoices/status-badge";
import { AddPartnerDialog } from "@/components/partners/add-partner-dialog";
import { AttachSplitsDialog } from "@/components/partners/attach-dialog";
import { DeactivatePartnerButton } from "@/components/partners/deactivate-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { ExportMenu } from "@/components/export/export-menu";
import { statusText } from "@/lib/export/format";
import type { ExportColumn, ExportRow } from "@/lib/export/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const metadata: Metadata = { title: "Partners" };

const PARTNER_COLUMNS: ExportColumn[] = [
  { key: "name", header: "Name" },
  { key: "email", header: "Email" },
  { key: "rail", header: "Rail" },
  { key: "account", header: "Account No." },
  { key: "bankCode", header: "Bank Code" },
  { key: "share", header: "Partner Share", align: "right" },
  { key: "status", header: "Status" },
];

const STATEMENT_COLUMNS: ExportColumn[] = [
  { key: "invoice", header: "Invoice" },
  { key: "status", header: "Status" },
  { key: "share", header: "Share", align: "right" },
  { key: "expected", header: "Expected (KES)", align: "right" },
  { key: "settled", header: "Settled (KES)", align: "right" },
];

type Statement = Awaited<ReturnType<typeof partnerStatement>>;

/** Statement rows + a closing totals row (all KES, formatted by the service). */
function statementExportRows(st: Statement): ExportRow[] {
  return [
    ...st.rows.map((r) => ({
      invoice: r.invoiceNumber,
      status: statusText(r.invoiceStatus),
      share: `${r.sharePct}%`,
      expected: r.expectedDisplay,
      settled: r.settledDisplay ?? "Not settled yet",
    })),
    {
      invoice: "Totals, last 90 days",
      status: "",
      share: "",
      expected: st.expectedTotalDisplay,
      settled: st.settledTotalDisplay,
    },
  ];
}

/** Mask the middle of an account number: first 2 + **** + last 3. */
function maskAccountNo(value: string): string {
  if (value.length > 5) return `${value.slice(0, 2)}****${value.slice(-3)}`;
  return "****";
}

export default async function PartnersPage() {
  const { business } = await requireBusiness();

  const partners = await listPartners(business.id);

  // Bank codes for the add-partner dialog — degrade to a free-text input.
  let bankOptions: { name?: string; code: string }[] = [];
  try {
    const resp = await bankCodes("KES");
    const list = Array.isArray(resp.data) ? (resp.data as Record<string, unknown>[]) : [];
    bankOptions = list
      .map((b) => ({
        name: typeof b.bankName === "string" ? b.bankName : undefined,
        code: String(b.bankCode ?? ""),
      }))
      .filter((b) => b.code.length > 0);
  } catch {
    bankOptions = [];
  }

  // Invoices splits can still be attached to (payment hasn't started moving).
  const invoiceRows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoices.status,
      buyerName: buyers.name,
    })
    .from(invoices)
    .innerJoin(buyers, eq(buyers.id, invoices.buyerId))
    .where(
      and(
        eq(invoices.businessId, business.id),
        inArray(invoices.status, ["ready", "sent", "partially_paid", "paid"]),
      ),
    )
    .orderBy(desc(invoices.createdAt))
    .limit(30);

  // 90-day statements, fetched server-side (collapsed by default).
  const since = new Date(Date.now() - 90 * 86_400_000);
  const now = new Date();
  const statements = await Promise.all(
    partners.map(async (p) => {
      try {
        return { partnerId: p.id, statement: await partnerStatement(business.id, p.id, since, now) };
      } catch {
        return { partnerId: p.id, statement: null };
      }
    }),
  );

  // Account numbers stay masked in exports, exactly as on screen.
  const partnerRows: ExportRow[] = partners.map((p) => ({
    name: p.name,
    email: p.email ?? "",
    rail: p.rail === "mpesa" ? "M-Pesa" : "Bank",
    account: maskAccountNo(p.accountNo),
    bankCode: p.bankCode ?? "",
    share: `${p.sharePct}%`,
    status: "Active",
  }));

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-xl font-semibold tracking-tight">Partners</h1>
            <p className="text-sm text-muted-foreground">
              Agents, freight forwarders and brokers, paid automatically from each collection.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AttachSplitsDialog
              partners={partners.map((p) => ({ id: p.id, name: p.name, sharePct: p.sharePct }))}
              invoices={invoiceRows}
            />
            <AddPartnerDialog bankOptions={bankOptions} />
          </div>
        </div>

        <Alert>
          <Info />
          <AlertTitle>How Partner Splits Work</AlertTitle>
          <AlertDescription>
            Partners (agents, freight, brokers) get paid automatically from each collection via
            Payaza split accounts, and splits ride along in the buyer&apos;s checkout.
          </AlertDescription>
        </Alert>

        {/* --------------------------------------------------- partner list -- */}
        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-4 py-3">
            <CardTitle>Split Beneficiaries</CardTitle>
            <CardDescription>
              {partners.length > 0
                ? `${partners.length} active partner${partners.length === 1 ? "" : "s"} · shares are what they receive; Payaza stores the inverse`
                : "Nobody yet. Add your first partner to start splitting collections."}
            </CardDescription>
            {partners.length > 0 && (
              <CardAction>
                <ExportMenu
                  title="Partners"
                  filename="kusanya-partners"
                  subtitle="Split beneficiaries"
                  businessName={business.name}
                  columns={PARTNER_COLUMNS}
                  rows={partnerRows}
                />
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {partners.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Users />
                  </EmptyMedia>
                  <EmptyTitle>No Partners Yet</EmptyTitle>
                  <EmptyDescription>
                    Add the agent, broker or haulier who helps your exports move. Kusanya
                    registers them as a Payaza split account and pays them automatically from
                    each collection.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rail</TableHead>
                    <TableHead>Account no.</TableHead>
                    <TableHead>Bank code</TableHead>
                    <TableHead>Share</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.email ?? <span className="text-muted-foreground">None</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {p.rail === "mpesa" ? (
                            <Smartphone data-icon="inline-start" />
                          ) : (
                            <Landmark data-icon="inline-start" />
                          )}
                          {p.rail === "mpesa" ? "M-Pesa" : "Bank"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">{maskAccountNo(p.accountNo)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">{p.bankCode ?? "None"}</span>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="secondary" className="cursor-help tabular-nums">
                              {p.sharePct}% partner share
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top" align="start" className="max-w-72">
                            Stored on Payaza as split_value {Number(p.splitValue)}. Payaza&apos;s
                            split_value is the platform-keep percentage; Kusanya handles the
                            inversion.
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">Active</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DeactivatePartnerButton partnerId={p.id} partnerName={p.name} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* ----------------------------------------------------- statements -- */}
        {partners.length > 0 ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="font-heading text-base font-medium">Statements</h2>
              <p className="text-sm text-muted-foreground">
                What each partner earned (and what has actually settled) over the last 90
                days. All amounts in KES.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {partners.map((p) => {
                const st = statements.find((s) => s.partnerId === p.id)?.statement ?? null;
                return (
                  <Collapsible key={p.id} className="rounded-lg border border-border">
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="group h-auto w-full justify-between gap-2 px-3 py-2.5 font-normal"
                      >
                        <span className="flex min-w-0 items-center gap-2 text-sm">
                          <Receipt className="shrink-0 text-muted-foreground" aria-hidden />
                          <span className="truncate">
                            Statement: {p.name} · Last 90 Days
                          </span>
                        </span>
                        <ChevronDown className="shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t px-1 py-2 sm:px-2">
                        {st && st.rows.length > 0 ? (
                          <>
                          <div className="flex justify-end px-1 pb-1">
                            <ExportMenu
                              title={`Partner Statement ${p.name}`}
                              filename={`kusanya-statement-${p.name}`}
                              subtitle="Last 90 days · all amounts in KES"
                              businessName={business.name}
                              columns={STATEMENT_COLUMNS}
                              rows={statementExportRows(st)}
                            />
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Invoice</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Share</TableHead>
                                <TableHead className="text-right">Expected (KES)</TableHead>
                                <TableHead className="text-right">Settled (KES)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {st.rows.map((r, i) => (
                                <TableRow key={`${r.invoiceNumber}-${i}`}>
                                  <TableCell className="font-mono text-xs">
                                    {r.invoiceNumber}
                                  </TableCell>
                                  <TableCell>
                                    <StatusBadge status={r.invoiceStatus} />
                                  </TableCell>
                                  <TableCell className="text-right font-mono tabular-nums">
                                    {r.sharePct}%
                                  </TableCell>
                                  <TableCell className="text-right font-mono tabular-nums">
                                    {r.expectedDisplay}
                                  </TableCell>
                                  <TableCell className="text-right font-mono tabular-nums">
                                    {r.settledDisplay ?? (
                                      <span className="font-sans text-muted-foreground">
                                        Not settled yet
                                      </span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                            <TableFooter>
                              <TableRow>
                                <TableCell colSpan={3}>Totals · last 90 days</TableCell>
                                <TableCell className="text-right font-mono tabular-nums">
                                  {st.expectedTotalDisplay}
                                </TableCell>
                                <TableCell className="text-right font-mono tabular-nums">
                                  {st.settledTotalDisplay}
                                </TableCell>
                              </TableRow>
                            </TableFooter>
                          </Table>
                          </>
                        ) : (
                          <Empty>
                            <EmptyHeader>
                              <EmptyTitle>Nothing In The Last 90 Days</EmptyTitle>
                              <EmptyDescription>
                                No invoice splits for {p.name} in this window. Attach their
                                split to an invoice and it will show up here.
                              </EmptyDescription>
                            </EmptyHeader>
                          </Empty>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}

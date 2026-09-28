import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Plus, ShieldCheck } from "lucide-react";

import { requireBusiness } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import {
  buyers,
  invoices,
  riskAssessments,
  type RiskAssessment,
} from "@/lib/db/schema";
import { Amount } from "@/components/money/amount";
import { StatusBadge } from "@/components/invoices/status-badge";
import { OverrideActions } from "@/components/review/override-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
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
import { ExportMenu } from "@/components/export/export-menu";
import { dateText, moneyText, statusText } from "@/lib/export/format";
import type { ExportColumn, ExportRow } from "@/lib/export/types";

export const metadata: Metadata = { title: "Risk Queue" };

const EXPORT_COLUMNS: ExportColumn[] = [
  { key: "invoice", header: "Invoice" },
  { key: "buyer", header: "Buyer" },
  { key: "country", header: "Country" },
  { key: "amount", header: "Amount", align: "right" },
  { key: "status", header: "Status" },
  { key: "decision", header: "Decision" },
  { key: "score", header: "Score", align: "right" },
  { key: "screening", header: "Screening" },
  { key: "flagged", header: "Flagged" },
  { key: "due", header: "Due" },
  { key: "signals", header: "Signals" },
];

function signalText(r: ReasonDto): string {
  const label = r.label ?? r.key ?? "Signal";
  const p = typeof r.probability === "number" ? `P=${r.probability.toFixed(2)}` : null;
  const w = typeof r.weight === "number" ? `w${r.weight}` : null;
  return [label, [p, w].filter(Boolean).join(" x ")].filter(Boolean).join(" ");
}

/** One entry of riskAssessments.reasons (jsonb) — render defensively. */
interface ReasonDto {
  key?: string;
  label?: string;
  probability?: number;
  weight?: number;
  criterion?: string;
}

const DECISION_BADGE: Record<
  RiskAssessment["decision"],
  { variant: "secondary" | "destructive" | "outline"; label: string }
> = {
  pass: { variant: "outline", label: "Pass" },
  review: { variant: "secondary", label: "Review" },
  hold: { variant: "destructive", label: "Hold" },
};

/** Risk queue — every invoice the composite screen flagged, fail-closed. */
export default async function ReviewPage() {
  const { business } = await requireBusiness();

  const rows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoices.status,
      currency: invoices.currency,
      amountMinor: invoices.amountMinor,
      dueAt: invoices.dueAt,
      createdAt: invoices.createdAt,
      buyerName: buyers.name,
      buyerCountry: buyers.country,
    })
    .from(invoices)
    .innerJoin(buyers, eq(buyers.id, invoices.buyerId))
    .where(
      and(
        eq(invoices.businessId, business.id),
        inArray(invoices.status, ["review", "on_hold"]),
      ),
    )
    .orderBy(desc(invoices.createdAt));

  const ids = rows.map((r) => r.id);
  const assessments =
    ids.length > 0
      ? await db
          .select()
          .from(riskAssessments)
          .where(inArray(riskAssessments.invoiceId, ids))
          .orderBy(desc(riskAssessments.createdAt))
      : [];

  // Latest assessment per invoice (rows arrive newest-first).
  const latest = new Map<string, RiskAssessment>();
  for (const a of assessments) {
    if (!latest.has(a.invoiceId)) latest.set(a.invoiceId, a);
  }

  const exportRows: ExportRow[] = rows.map((row) => {
    const risk = latest.get(row.id);
    const reasons: ReasonDto[] = Array.isArray(risk?.reasons) ? (risk?.reasons as ReasonDto[]) : [];
    return {
      invoice: row.number,
      buyer: row.buyerName,
      country: row.buyerCountry,
      amount: moneyText(row.currency, row.amountMinor),
      status: statusText(row.status),
      decision: risk ? DECISION_BADGE[risk.decision].label : "",
      score: risk ? `${risk.compositeScore}/100` : "",
      screening: risk ? (risk.fallback ? "Fail-safe default" : "AI + rules") : "No assessment",
      flagged: dateText(row.createdAt),
      due: row.dueAt ? dateText(row.dueAt) : "On receipt",
      signals: reasons.map(signalText).join("; "),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Risk Queue
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Composite score = weighted AI judgments + deterministic facts. Hold is
            fail-closed: nothing sends until you decide.
          </p>
        </div>
        {rows.length > 0 && (
          <ExportMenu
            title="Risk Review Queue"
            filename="kusanya-risk-queue"
            subtitle="Invoices flagged for review or on hold"
            businessName={business.name}
            columns={EXPORT_COLUMNS}
            rows={exportRows}
            size="default"
          />
        )}
      </header>

      {rows.length === 0 ? (
        <Empty className="border border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldCheck />
            </EmptyMedia>
            <EmptyTitle>Queue Clear, Nothing Flagged</EmptyTitle>
            <EmptyDescription>
              Every recent invoice passed its risk screen. Anything flagged for
              review or held lands here, and nothing sends without you.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/app/invoices/new">
                <Plus data-icon="inline-start" />
                New Invoice
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((row) => {
            const risk = latest.get(row.id);
            const reasons: ReasonDto[] = Array.isArray(risk?.reasons)
              ? (risk?.reasons as ReasonDto[])
              : [];
            const decision = risk ? DECISION_BADGE[risk.decision] : null;

            return (
              <Card key={row.id}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link
                      href={`/app/invoices/${row.id}`}
                      className="font-mono text-sm underline-offset-4 hover:underline"
                    >
                      {row.number}
                    </Link>
                    <span aria-hidden="true" className="text-muted-foreground">
                      ·
                    </span>
                    <span>{row.buyerName}</span>
                    <Badge variant="outline" className="font-mono">
                      {row.buyerCountry}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-2">
                    <Amount minor={row.amountMinor} currency={row.currency} />
                    <StatusBadge status={row.status} />
                    {decision && (
                      <Badge variant={decision.variant}>{decision.label}</Badge>
                    )}
                    {risk?.fallback && (
                      <Badge variant="outline">
                        Fail-safe default: AI was unavailable
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Flagged{" "}
                      {row.createdAt.toLocaleDateString("en-KE", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    {row.dueAt && (
                      <span className="text-xs text-muted-foreground">
                        · Due{" "}
                        {row.dueAt.toLocaleDateString("en-KE", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </CardDescription>
                  {risk && (
                    <CardAction>
                      <div className="flex items-baseline gap-1">
                        <span
                          className={
                            risk.decision === "hold"
                              ? "font-mono text-3xl font-semibold text-destructive tabular-nums"
                              : "font-mono text-3xl font-semibold tabular-nums"
                          }
                        >
                          {risk.compositeScore}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          /100
                        </span>
                      </div>
                    </CardAction>
                  )}
                </CardHeader>

                <CardContent>
                  {reasons.length > 0 ? (
                    <ul className="flex flex-col gap-2">
                      {reasons.map((r, i) => (
                        <li key={r.key ?? i} className="flex flex-col gap-0.5">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-sm font-medium">
                              {r.label ?? r.key ?? "Signal"}
                            </span>
                            <span className="font-mono text-xs text-muted-foreground">
                              P=
                              {typeof r.probability === "number"
                                ? r.probability.toFixed(2)
                                : "—"}{" "}
                              × w{typeof r.weight === "number" ? r.weight : "—"}
                            </span>
                          </div>
                          {r.criterion && (
                            <p className="max-w-2xl text-xs text-muted-foreground">
                              {r.criterion}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No assessment on file for this invoice.
                    </p>
                  )}
                </CardContent>

                <CardFooter>
                  <OverrideActions invoiceId={row.id} status={row.status} />
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

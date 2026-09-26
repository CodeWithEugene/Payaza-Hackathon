import { AlertTriangle, Ban, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RiskOverride } from "@/components/invoices/risk-override";

/**
 * Risk screening card — shows the composite score, the decision, and every
 * reason with its probability × weight so the merchant can see WHY (never a
 * black box). Review/hold decisions offer an audited human override.
 */

export interface RiskReasonRow {
  key?: string;
  label?: string;
  probability?: number;
  weight?: number;
  criterion?: string;
}

export interface RiskCardRow {
  compositeScore: number;
  decision: string;
  reasons: unknown;
  fallback: boolean;
}

function DecisionBadge({ decision }: { decision: string }) {
  if (decision === "pass") {
    return (
      <Badge variant="secondary">
        <ShieldCheck data-icon="inline-start" />
        Passed
      </Badge>
    );
  }
  if (decision === "review") {
    return (
      <Badge variant="secondary">
        <AlertTriangle data-icon="inline-start" />
        Needs review
      </Badge>
    );
  }
  if (decision === "hold") {
    return (
      <Badge variant="destructive">
        <Ban data-icon="inline-start" />
        On hold
      </Badge>
    );
  }
  return <Badge variant="outline">{decision}</Badge>;
}

function parseReasons(reasons: unknown): RiskReasonRow[] {
  if (!Array.isArray(reasons)) return [];
  return reasons.filter(
    (r): r is RiskReasonRow => r != null && typeof r === "object" && !Array.isArray(r),
  );
}

export function RiskCard({
  invoiceId,
  risk,
}: {
  invoiceId: string;
  risk: RiskCardRow | undefined;
}) {
  if (!risk) return null;
  const reasons = parseReasons(risk.reasons);
  const needsHuman = risk.decision === "review" || risk.decision === "hold";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk screening</CardTitle>
        <CardDescription>
          Checked automatically before this invoice could be sent.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-4xl font-semibold tabular-nums">
              {risk.compositeScore}
            </span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
          <DecisionBadge decision={risk.decision} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Composite risk score</span>
          {risk.fallback && (
            <Badge variant="outline">Rule-based (Jev unavailable or demo)</Badge>
          )}
        </div>

        {reasons.length > 0 && (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {reasons.map((reason, i) => (
              <li key={reason.key ?? `${reason.label ?? "reason"}-${i}`} className="flex flex-col gap-1 p-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium">
                    {reason.label ?? reason.key ?? "Risk factor"}
                  </span>
                  {(typeof reason.probability === "number" || typeof reason.weight === "number") && (
                    <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                      {typeof reason.probability === "number" && `P=${reason.probability.toFixed(2)}`}
                      {typeof reason.probability === "number" && typeof reason.weight === "number" && " × "}
                      {typeof reason.weight === "number" && `w${reason.weight}`}
                    </span>
                  )}
                </div>
                {reason.criterion && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {reason.criterion}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {needsHuman && (
          <div className="flex flex-col gap-2">
            {risk.decision === "hold" && (
              <p className="text-sm text-muted-foreground">
                This invoice is on hold — it will not be sent until you override the
                decision or cancel it.
              </p>
            )}
            {risk.decision === "review" && (
              <p className="text-sm text-muted-foreground">
                A human look was requested before sending. Approve it to Ready, or
                cancel — either way it&apos;s logged with your note.
              </p>
            )}
            <RiskOverride invoiceId={invoiceId} current={risk.decision} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

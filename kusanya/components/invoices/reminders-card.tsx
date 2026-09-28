import { Ban, Mail, MessageCircle, Smartphone, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReminderActions } from "@/components/invoices/reminder-actions";

/**
 * Gentle dunning card — reminders are drafted, guardrail-checked against
 * ledger facts, and only ever sent with the merchant's explicit approval.
 */

export interface ReminderRow {
  id: string;
  channel: string;
  body: string | null;
  scheduledAt: Date | null;
  sentAt: Date | null;
  status: string;
  draftedBy: string;
  guardrail: unknown;
}

const CHANNEL_META: Record<string, { label: string; Icon: typeof Mail }> = {
  email: { label: "Email", Icon: Mail },
  sms: { label: "SMS", Icon: Smartphone },
  whatsapp: { label: "WhatsApp", Icon: MessageCircle },
};

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function guardrailText(guardrail: unknown): string | null {
  if (!guardrail || typeof guardrail !== "object") return null;
  const g = guardrail as {
    blocked?: boolean;
    reason?: string;
    claims?: { claim?: string; supported?: boolean }[];
  };
  const claims = Array.isArray(g.claims) ? g.claims : [];
  const bad = claims.filter((c) => c && typeof c === "object" && c.supported === false);
  if (bad.length > 0) {
    const first = typeof bad[0]?.claim === "string" ? bad[0].claim : null;
    return first ? `Unsupported claim: “${first}”` : `${bad.length} unsupported claims`;
  }
  if (typeof g.reason === "string" && g.reason.trim()) return g.reason;
  return null;
}

function StatusPill({ row }: { row: ReminderRow }) {
  switch (row.status) {
    case "scheduled":
      return (
        <Badge variant="outline">
          Scheduled {row.scheduledAt ? dateFmt.format(row.scheduledAt) : ""}
        </Badge>
      );
    case "draft":
      return <Badge variant="secondary">Draft: awaiting your OK</Badge>;
    case "blocked":
      return (
        <Badge variant="destructive">
          <Ban data-icon="inline-start" />
          Blocked
        </Badge>
      );
    case "sent":
      return (
        <Badge variant="secondary">
          Sent {row.sentAt ? dateFmt.format(row.sentAt) : ""}
        </Badge>
      );
    case "cancelled":
      return <Badge variant="outline">Cancelled</Badge>;
    default:
      return <Badge variant="outline">{row.status}</Badge>;
  }
}

export function RemindersCard({
  invoiceId,
  reminders,
}: {
  invoiceId: string;
  reminders: ReminderRow[];
}) {
  if (reminders.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reminders</CardTitle>
        <CardDescription>
          Polite nudges, drafted and fact-checked. Nothing sends without you.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {reminders.map((row) => {
          const meta = CHANNEL_META[row.channel] ?? { label: row.channel, Icon: Mail };
          // The DB enum has no "blocked" — a guardrail-blocked draft keeps
          // status "draft" with guardrail.blocked = true. Treat both as blocked.
          const guardBlocked =
            (row.guardrail as { blocked?: boolean } | null)?.blocked === true;
          const effectiveStatus =
            row.status === "blocked" || (row.status === "draft" && guardBlocked)
              ? "blocked"
              : row.status;
          const blocked = effectiveStatus === "blocked";
          const blockedText = blocked ? guardrailText(row.guardrail) : null;
          const statusRow = { ...row, status: effectiveStatus };
          return (
            <div key={row.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-border text-muted-foreground">
                    <meta.Icon className="size-3.5" />
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium">{meta.label} reminder</span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {(row.draftedBy === "ai" || row.draftedBy === "jev") && (
                        <>
                          <Sparkles className="size-3" />
                          AI-drafted ·
                        </>
                      )}
                      {row.scheduledAt
                        ? `Scheduled ${dateFmt.format(row.scheduledAt)}`
                        : "Unscheduled"}
                    </span>
                  </div>
                </div>
                <StatusPill row={statusRow} />
              </div>

              {row.body && (
                <p className="text-sm leading-relaxed break-words text-muted-foreground">
                  {row.body}
                </p>
              )}

              {blocked && (
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-destructive">
                    The guardrail blocked this draft, so it won&apos;t send.
                    {blockedText ? ` ${blockedText}.` : ""}
                  </p>
                  {!blockedText && row.guardrail != null && (
                    <code className="overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs text-muted-foreground">
                      {JSON.stringify(row.guardrail)}
                    </code>
                  )}
                </div>
              )}

              <ReminderActions
                invoiceId={invoiceId}
                reminderId={row.id}
                status={statusRow.status}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

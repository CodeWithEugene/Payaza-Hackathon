import { AlertTriangle, Ban, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LucideIcon } from "lucide-react";

/**
 * Status pills — strict shadcn/ui (nova preset law): built-in Badge variants
 * + semantic tokens only, icons for differentiation. No raw palette colors.
 */

const MAP: Record<
  string,
  { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon?: LucideIcon }
> = {
  // invoice lifecycle
  draft: { variant: "outline", label: "Draft" },
  ready: { variant: "secondary", label: "Ready to send" },
  sent: { variant: "default", label: "Sent" },
  partially_paid: { variant: "secondary", label: "Partially paid", icon: Clock },
  paid: { variant: "default", label: "Paid" },
  settling: { variant: "secondary", label: "Settling", icon: Clock },
  settled: { variant: "secondary", label: "Settled" },
  paying_out: { variant: "secondary", label: "Paying out", icon: Clock },
  completed: { variant: "default", label: "Imefika! Completed", icon: CheckCircle2 },
  failed: { variant: "destructive", label: "Failed", icon: XCircle },
  cancelled: { variant: "outline", label: "Cancelled", icon: XCircle },
  review: { variant: "secondary", label: "Needs review", icon: AlertTriangle },
  on_hold: { variant: "destructive", label: "On hold", icon: Ban },
  // txn / payout statuses
  initialized: { variant: "outline", label: "Initialized" },
  pending: { variant: "secondary", label: "Pending", icon: Clock },
  reversed: { variant: "destructive", label: "Reversed", icon: XCircle },
  escrow: { variant: "secondary", label: "Escrow" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = MAP[status] ?? { variant: "outline" as const, label: status };
  const Icon = s.icon;
  return (
    <Badge variant={s.variant}>
      {Icon && <Icon data-icon="inline-start" />}
      {s.label}
    </Badge>
  );
}

export function statusLabel(status: string): string {
  return MAP[status]?.label ?? status;
}

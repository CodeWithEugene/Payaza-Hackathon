import { AlertTriangle, Ban, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LucideIcon } from "lucide-react";

/**
 * Status pills: shadcn Badge variants plus a semantic TONE from the brand
 * tokens (no raw palette colors): money in = leaf green, in flight = indigo,
 * waiting on a person = sunset. Icons + labels still carry the meaning, so
 * color is never the only signal.
 */

type Tone = "success" | "progress" | "attention";

const TONE_CLASS: Record<Tone, string> = {
  success: "border-transparent bg-brand-leaf/12 text-brand-leaf",
  progress: "border-transparent bg-primary/12 text-primary",
  attention: "border-transparent bg-brand-sunset/14 text-brand-sunset",
};

const TONE: Partial<Record<string, Tone>> = {
  sent: "progress",
  settling: "progress",
  paying_out: "progress",
  pending: "progress",
  paid: "success",
  settled: "success",
  completed: "success",
  partially_paid: "attention",
  review: "attention",
};

const MAP: Record<
  string,
  { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon?: LucideIcon }
> = {
  // invoice lifecycle
  draft: { variant: "outline", label: "Draft" },
  ready: { variant: "secondary", label: "Ready To Send" },
  sent: { variant: "default", label: "Sent" },
  partially_paid: { variant: "secondary", label: "Partially Paid", icon: Clock },
  paid: { variant: "default", label: "Paid", icon: CheckCircle2 },
  settling: { variant: "secondary", label: "Settling", icon: Clock },
  settled: { variant: "secondary", label: "Settled", icon: CheckCircle2 },
  paying_out: { variant: "secondary", label: "Paying Out", icon: Clock },
  completed: { variant: "default", label: "Imefika! Completed", icon: CheckCircle2 },
  failed: { variant: "destructive", label: "Failed", icon: XCircle },
  cancelled: { variant: "outline", label: "Cancelled", icon: XCircle },
  review: { variant: "secondary", label: "Needs Review", icon: AlertTriangle },
  on_hold: { variant: "destructive", label: "On Hold", icon: Ban },
  // txn / payout statuses
  initialized: { variant: "outline", label: "Initialized" },
  pending: { variant: "secondary", label: "Pending", icon: Clock },
  reversed: { variant: "destructive", label: "Reversed", icon: XCircle },
  escrow: { variant: "secondary", label: "Escrow" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = MAP[status] ?? { variant: "outline" as const, label: status };
  const Icon = s.icon;
  const tone = TONE[status];
  return (
    <Badge variant={tone ? "outline" : s.variant} className={tone ? TONE_CLASS[tone] : undefined}>
      {Icon && <Icon data-icon="inline-start" />}
      {s.label}
    </Badge>
  );
}

export function statusLabel(status: string): string {
  return MAP[status]?.label ?? status;
}

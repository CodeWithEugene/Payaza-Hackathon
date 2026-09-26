import {
  Banknote,
  BellRing,
  Circle,
  FilePlus2,
  Flag,
  Landmark,
  Send,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

export interface TimelineEvent {
  at: Date;
  /** One of: send | paid | settle | payout | reminder | flag | created */
  icon: string;
  title: string;
  detail?: string;
  tone?: "default" | "destructive";
}

const ICONS: Record<string, LucideIcon> = {
  send: Send,
  paid: Banknote,
  settle: Landmark,
  payout: Wallet,
  reminder: BellRing,
  flag: Flag,
  created: FilePlus2,
};

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Vertical timeline of everything that happened on an invoice, oldest first. */
export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Circle />
          </EmptyMedia>
          <EmptyTitle>Nothing has happened yet</EmptyTitle>
          <EmptyDescription>
            Every send, payment, settlement, and payout will appear here as it happens.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ol className="flex flex-col">
      {events.map((event, i) => {
        const Icon = ICONS[event.icon] ?? Circle;
        const destructive = event.tone === "destructive";
        const isLast = i === events.length - 1;
        return (
          <li key={`${event.at.getTime()}-${i}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full border bg-card",
                  destructive ? "border-destructive/40 text-destructive" : "border-border text-muted-foreground",
                )}
              >
                <Icon className="size-4" />
              </span>
              {!isLast && <span className="w-0 flex-1 border-l border-border" aria-hidden="true" />}
            </div>
            <div className={cn("flex min-w-0 flex-col gap-0.5", !isLast && "pb-6")}>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className={cn("text-sm font-medium", destructive && "text-destructive")}>
                  {event.title}
                </span>
                <span className="text-xs text-muted-foreground">{timeFormatter.format(event.at)}</span>
              </div>
              {event.detail && (
                <p className="text-sm break-words text-muted-foreground">{event.detail}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

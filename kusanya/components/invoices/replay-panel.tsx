"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

interface ReplayEvent {
  event: string;
  label: string;
  ref: "collection" | "payout" | "invoice";
}

const REPLAYS: ReplayEvent[] = [
  { event: "collection.success", label: "Card Payment Succeeds", ref: "collection" },
  { event: "momo.success", label: "M-Pesa Payment Succeeds", ref: "collection" },
  { event: "collection.failed", label: "Payment Fails", ref: "collection" },
  { event: "collection.underpay", label: "Underpayment 85%", ref: "collection" },
  { event: "payout.success", label: "Payout Succeeds", ref: "payout" },
  { event: "payout.failed", label: "Payout Fails", ref: "payout" },
  { event: "settlement.complete", label: "Settlement Completes", ref: "invoice" },
];

/**
 * Demo Mode only — fires synthetic Payaza webhooks through POST /api/demo/replay.
 * Same signature-checked pipeline as production; nothing here touches the ledger
 * directly.
 */
export function ReplayPanel({
  invoiceId,
  txnRefs,
  demoMode,
}: {
  invoiceId: string;
  txnRefs: { collectionRef?: string | null; payoutRef?: string | null };
  demoMode: boolean;
}) {
  const router = useRouter();
  const [busyEvent, setBusyEvent] = useState<string | null>(null);

  if (!demoMode) return null;

  function referenceFor(ref: ReplayEvent["ref"]): string | null {
    if (ref === "collection") return txnRefs.collectionRef ?? null;
    if (ref === "payout") return txnRefs.payoutRef ?? null;
    return invoiceId;
  }

  async function replay(item: ReplayEvent) {
    const reference = referenceFor(item.ref);
    if (busyEvent || !reference) return;
    setBusyEvent(item.event);
    try {
      const res = await fetch("/api/demo/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: item.event, reference }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; ok?: boolean; outcome?: string; detail?: string }
        | null;
      if (!res.ok || !data || typeof data.error === "string") {
        toast.error(data?.error ?? "Replay failed.");
        return;
      }
      if (data.ok === false) {
        toast(`Replayed: ${item.event}. ${data.detail ?? data.outcome ?? "no change (already processed?)"}`);
      } else {
        toast.success(`Replayed: ${item.event}`);
      }
      // Give the webhook pipeline a beat to land, then pull the fresh state.
      await new Promise((resolve) => setTimeout(resolve, 1200));
      router.refresh();
    } catch {
      toast.error("Replay failed. Is the demo API running?");
    } finally {
      setBusyEvent(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="size-4 text-muted-foreground" />
          Demo Controls
        </CardTitle>
        <CardDescription>
          Synthetic Payaza webhooks, same code path as live.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          {REPLAYS.map((item) => {
            const reference = referenceFor(item.ref);
            const disabled = busyEvent !== null || !reference;
            const missingHint =
              item.ref === "collection" && !txnRefs.collectionRef
                ? "No collection transaction on this invoice yet."
                : item.ref === "payout" && !txnRefs.payoutRef
                  ? "No payout transaction on this invoice yet."
                  : undefined;
            return (
              <Button
                key={item.event}
                variant="outline"
                size="sm"
                className="justify-start"
                onClick={() => replay(item)}
                disabled={disabled}
                title={missingHint}
              >
                {busyEvent === item.event ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <FlaskConical data-icon="inline-start" />
                )}
                <span className="truncate">{item.label}</span>
              </Button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Replays flow through the real webhook pipeline: signature-checked entry
          point, dedupe, single completion path.
        </p>
      </CardContent>
    </Card>
  );
}

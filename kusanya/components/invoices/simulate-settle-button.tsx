"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { simulateSettlementAction } from "@/lib/actions/invoices";

/** Demo Mode: advance a paid invoice to settled without waiting for Payaza. */
export function SimulateSettleButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await simulateSettlementAction(invoiceId);
      if (res.ok) {
        toast.success("Settlement simulated — the funds are now in your KES wallet.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not simulate settlement.");
      }
    } catch {
      toast.error("Could not simulate settlement. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" onClick={run} disabled={busy}>
      {busy ? <Spinner data-icon="inline-start" /> : <Zap data-icon="inline-start" />}
      Simulate settlement
    </Button>
  );
}

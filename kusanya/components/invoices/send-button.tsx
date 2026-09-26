"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCw, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { resendInvoiceAction, sendInvoiceAction } from "@/lib/actions/invoices";

/**
 * Send / resend island for the invoice header. Server actions return
 * ActionResult — persona copy surfaces verbatim on error (contract §10/§11).
 */
export function SendButton({
  invoiceId,
  action = "send",
}: {
  invoiceId: string;
  action?: "send" | "resend";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    if (busy) return;
    setBusy(true);
    try {
      const res =
        action === "resend"
          ? await resendInvoiceAction(invoiceId)
          : await sendInvoiceAction(invoiceId);
      if (res.ok) {
        toast.success(
          action === "resend"
            ? "Invoice resent — the buyer has a fresh payment link."
            : "Invoice sent — email and SMS are on their way to the buyer.",
        );
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not send the invoice.");
      }
    } catch {
      toast.error("Could not send the invoice. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (action === "resend") {
    return (
      <Button variant="outline" onClick={run} disabled={busy}>
        {busy ? <Spinner data-icon="inline-start" /> : <RotateCw data-icon="inline-start" />}
        Resend
      </Button>
    );
  }

  return (
    <Button onClick={run} disabled={busy}>
      {busy ? <Spinner data-icon="inline-start" /> : <Send data-icon="inline-start" />}
      Send invoice
    </Button>
  );
}

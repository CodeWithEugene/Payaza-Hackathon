"use client";

import { useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cancelInvoiceAction } from "@/lib/actions/invoices";

/** Cancel island — AlertDialog with an audit reason, wired to cancelInvoiceAction. */
export function CancelButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirmCancel(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault(); // keep the dialog open until the action resolves
    if (busy) return;
    setBusy(true);
    try {
      const res = await cancelInvoiceAction(invoiceId, reason.trim());
      if (res.ok) {
        toast.success("Invoice cancelled. The buyer's payment link is closed.");
        setOpen(false);
        setReason("");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not cancel the invoice.");
      }
    } catch {
      toast.error("Could not cancel the invoice. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="text-destructive hover:text-destructive">
          <Ban data-icon="inline-start" />
          Cancel
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel This Invoice?</AlertDialogTitle>
          <AlertDialogDescription>
            The buyer&apos;s payment link stops working immediately. The invoice stays on
            record, and the cancellation is written to your audit log.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Field>
          <FieldLabel htmlFor="cancel-reason">Reason</FieldLabel>
          <Input
            id="cancel-reason"
            placeholder="e.g. buyer changed the order"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={busy}
            aria-invalid={reason.length > 0 && reason.trim().length === 0}
          />
          <FieldDescription>A few honest words for the audit trail.</FieldDescription>
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep Invoice</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy || reason.trim().length === 0}
            onClick={confirmCancel}
          >
            {busy && <Spinner data-icon="inline-start" />}
            Cancel Invoice
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

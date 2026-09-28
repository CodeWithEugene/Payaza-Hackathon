"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

/**
 * OverrideActions — resolve a flagged invoice from the risk queue. Both
 * outcomes require a note (audit requirement) and go through
 * POST /api/invoices/[id]/risk/override.
 */

type OverrideTarget = "ready" | "cancelled";

export function OverrideActions({
  invoiceId,
  status,
}: {
  invoiceId: string;
  status: string;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<OverrideTarget | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  function open(t: OverrideTarget) {
    setNote("");
    setTarget(t);
  }

  async function submit() {
    if (!target) return;
    if (note.trim().length < 2) {
      toast.error("Add a short note explaining the override (audit requirement).");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/risk/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: target, note: note.trim() }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!res.ok) {
        toast.error(data?.error ?? "Could not apply the override.");
        return;
      }
      if (target === "ready") {
        toast.success("Approved. Open the invoice to send it.");
      } else {
        toast.success("Invoice cancelled. The buyer's payment link is off.");
      }
      setTarget(null);
      router.refresh();
    } catch {
      toast.error("Could not apply the override. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const flagCopy = status === "on_hold" ? "put this invoice on hold" : "flagged this invoice for review";

  return (
    <div className="flex flex-1 flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => open("ready")}
        disabled={busy}
      >
        <Check data-icon="inline-start" />
        Approve → Ready
      </Button>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => open("cancelled")}
        disabled={busy}
      >
        <Ban data-icon="inline-start" />
        Cancel Invoice
      </Button>
      <span className="text-xs text-muted-foreground">
        Every override is written to the audit log with your note.
      </span>

      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {target === "cancelled"
                ? "Cancel This Invoice?"
                : "Approve And Mark Ready?"}
            </DialogTitle>
            <DialogDescription>
              The risk screen {flagCopy}.{" "}
              {target === "cancelled"
                ? "Cancelling closes it for good, and the buyer gets no payment link."
                : "Approving moves it to Ready; you still send it yourself from the invoice page."}
            </DialogDescription>
          </DialogHeader>

          <Field data-invalid={note.trim().length > 0 && note.trim().length < 2}>
            <FieldLabel htmlFor="override-note">
              Why? (audit requirement)
            </FieldLabel>
            <Textarea
              id="override-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                target === "cancelled"
                  ? "e.g. Buyer cancelled the order on Telegram."
                  : "e.g. Called the buyer, order and amount confirmed."
              }
              aria-invalid={note.trim().length > 0 && note.trim().length < 2}
            />
            <FieldDescription>
              {note.trim().length < 2
                ? "Minimum 2 characters. This note is saved with your name."
                : "Saved to the audit log with your name."}
            </FieldDescription>
          </Field>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={busy}>
                Keep As Is
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant={target === "cancelled" ? "destructive" : "default"}
              onClick={submit}
              disabled={busy || note.trim().length < 2}
            >
              {busy ? (
                <Spinner data-icon="inline-start" />
              ) : target === "cancelled" ? (
                <Ban data-icon="inline-start" />
              ) : (
                <Check data-icon="inline-start" />
              )}
              {target === "cancelled" ? "Cancel Invoice" : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

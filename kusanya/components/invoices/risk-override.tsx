"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

type OverrideTarget = "ready" | "cancelled";

const TARGET_LABELS: Record<OverrideTarget, string> = {
  ready: "Ready to send",
  cancelled: "Cancel the invoice",
};

/**
 * Human-in-the-loop risk override — every decision is audit-logged with the
 * merchant's note (POST /api/invoices/{id}/risk/override).
 */
export function RiskOverride({
  invoiceId,
  current,
}: {
  invoiceId: string;
  current: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState<OverrideTarget>("ready");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const noteTooShort = note.trim().length < 2;

  async function submit() {
    if (busy || noteTooShort) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/risk/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, note: note.trim() }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; status?: string }
        | null;
      if (!res.ok || !data || typeof data.error === "string") {
        toast.error(
          data?.error ?? "Could not apply the override. Please try again.",
        );
        return;
      }
      toast.success(
        `Decision updated — invoice moved to ${TARGET_LABELS[to].toLowerCase()}.`,
      );
      setOpen(false);
      setNote("");
      setTo("ready");
      router.refresh();
    } catch {
      toast.error("Could not apply the override. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ShieldAlert data-icon="inline-start" />
          Override decision
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Override risk decision</DialogTitle>
          <DialogDescription>
            You&apos;re taking a flagged invoice back into your own hands. Overrides
            are written to the audit log with your note.
          </DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel>Move invoice to</FieldLabel>
          <Select
            value={to}
            onValueChange={(value) => {
              if (value === "ready" || value === "cancelled") setTo(value);
            }}
            disabled={busy}
          >
            <SelectTrigger className="w-full" aria-label="New status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="ready">{TARGET_LABELS.ready}</SelectItem>
                <SelectItem value="cancelled">{TARGET_LABELS.cancelled}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          {current === "review" && to === "ready" && (
            <FieldDescription>
              After approving to Ready, use <span className="font-medium text-foreground">Send invoice</span> on
              the invoice header to release it to the buyer.
            </FieldDescription>
          )}
        </Field>

        <Field data-invalid={noteTooShort && note.length > 0 ? true : undefined}>
          <FieldLabel htmlFor="override-note">Note</FieldLabel>
          <Textarea
            id="override-note"
            placeholder="e.g. Called the buyer — they confirmed the order by phone."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={busy}
            aria-invalid={noteTooShort && note.length > 0}
          />
          <FieldDescription>
            Required (min 2 characters) — this is your audit trail for the override.
          </FieldDescription>
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Back
          </Button>
          <Button onClick={submit} disabled={busy || noteTooShort}>
            {busy && <Spinner data-icon="inline-start" />}
            Apply override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

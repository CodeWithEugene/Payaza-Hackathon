"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserX } from "lucide-react";

import { deactivatePartnerAction } from "@/lib/actions/rails-partners";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * Row action on the partners table — deactivates a split beneficiary.
 * Existing statements stay intact; future collections stop splitting to them.
 */
export function DeactivatePartnerButton({
  partnerId,
  partnerName,
}: {
  partnerId: string;
  partnerName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function handleDeactivate() {
    setBusy(true);
    const res = await deactivatePartnerAction(partnerId);
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      toast.success(`${partnerName} deactivated — future collections won't split to them.`);
      router.refresh();
    } else {
      toast.error(res.error ?? "Could not deactivate partner.");
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Deactivate ${partnerName}`}
          title={`Deactivate ${partnerName}`}
        >
          <UserX />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <UserX />
          </AlertDialogMedia>
          <AlertDialogTitle>Deactivate {partnerName}?</AlertDialogTitle>
          <AlertDialogDescription>
            They stop receiving splits from future collections. Invoices that already carry
            their split keep it, and their statements stay available. You can add them again
            anytime.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              void handleDeactivate();
            }}
          >
            {busy ? <Spinner data-icon="inline-start" /> : <UserX data-icon="inline-start" />}
            Deactivate partner
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CreditCard, FlaskConical, LogIn, RotateCcw, ShieldCheck } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";

/** Demo Mode facts + reset. Renders nothing at all when keys are configured. */
export function DemoCard({ demoMode, sandbox = false }: { demoMode: boolean; sandbox?: boolean }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function handleReset() {
    setBusy(true);
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.ok) {
        setConfirmOpen(false);
        toast.success(
          "Demo data reset — the FreshLeaf story is reseeded. Sign in with the demo login if you're asked.",
        );
        router.refresh();
      } else {
        toast.error(body?.error ?? "Could not reset demo data.");
      }
    } catch {
      toast.error("Could not reset demo data.");
    } finally {
      setBusy(false);
    }
  }

  if (!demoMode) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Demo Mode</CardTitle>
        <CardDescription>
          {sandbox
            ? "Payaza sandbox keys are live: collections, payment links and splits hit Payaza's real test rails. Demo tools (reset, replay, simulated settlement) stay on for judging."
            : "No Payaza keys configured → the app runs on synthetic payloads that follow the exact live shapes. Same code paths, honest labels."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ItemGroup>
          <Item variant="muted">
            <ItemMedia variant="icon">
              <LogIn />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Demo login</ItemTitle>
              <ItemDescription className="font-mono">
                wanjiru@kusanya.demo · kusanya-demo-2026
              </ItemDescription>
            </ItemContent>
          </Item>
          <Item variant="muted">
            <ItemMedia variant="icon">
              <ShieldCheck />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Payout confirmation code</ItemTitle>
              <ItemDescription>
                Every payout confirmation gate in the demo accepts this code.
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Badge variant="secondary" className="font-mono">
                123456
              </Badge>
            </ItemActions>
          </Item>
          <Item variant="muted">
            <ItemMedia variant="icon">
              <CreditCard />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Payaza test card</ItemTitle>
              <ItemDescription>
                <span className="font-mono text-foreground">Visa 4508750015741019</span> ·
                expiry <span className="font-mono text-foreground">01/39</span> approves ·{" "}
                <span className="font-mono text-foreground">05/39</span> declines (any CVC,
                any future date).
              </ItemDescription>
            </ItemContent>
          </Item>
        </ItemGroup>
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <p>
            Emails/SMS the app sends appear in the sidebar &quot;Demo outbox&quot;.
          </p>
          <p>
            Webhooks replay from invoice detail pages (&quot;Demo controls&quot; card) —
            collection success, underpay, overpay, failure and settlement.
          </p>
        </div>
      </CardContent>
      <CardFooter className="gap-2 sm:justify-between">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FlaskConical className="size-3.5 shrink-0" aria-hidden />
          Resetting wipes invoices, transactions and partners, then reseeds the story.
        </p>
        <AlertDialog open={confirmOpen} onOpenChange={(next) => !busy && setConfirmOpen(next)}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <RotateCcw data-icon="inline-start" />
              Reset demo data
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia>
                <RotateCcw />
              </AlertDialogMedia>
              <AlertDialogTitle>Reset the demo story?</AlertDialogTitle>
              <AlertDialogDescription>
                This wipes every invoice, transaction and partner in the demo database and
                reseeds the FreshLeaf Exports story from scratch. You may be asked to sign in
                again with the demo login.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={busy}
                onClick={(e) => {
                  e.preventDefault();
                  void handleReset();
                }}
              >
                {busy ? <Spinner data-icon="inline-start" /> : <RotateCcw data-icon="inline-start" />}
                Reset demo data
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}

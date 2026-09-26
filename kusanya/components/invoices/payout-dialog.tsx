"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Landmark, Smartphone, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Amount } from "@/components/money/amount";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { initiatePayoutAction } from "@/lib/actions/rails-partners";

export interface PayoutRailOption {
  id: string;
  rail: string; // "mpesa" | "kepss_bank"
  phone: string | null;
  accountNumber: string | null;
  accountName: string | null;
  bankCode?: string | null;
  isDefault: boolean;
}

function railLabel(rail: PayoutRailOption): string {
  if (rail.rail === "mpesa") return `M-Pesa · ${rail.phone ?? "no number"}`;
  const bank = rail.bankCode ? `${rail.bankCode} · ` : "";
  return `Bank · ${bank}${rail.accountNumber ?? "no account"}`;
}

/**
 * Two-step payout dialog: pick a rail → initiatePayoutAction, then the
 * confirmation-code gate → POST /api/payouts/{id}/confirm. Money only moves
 * after both steps (confirmation policy "always_ask").
 */
export function PayoutDialog({
  invoiceId,
  rails,
  netMinor,
  netCurrency,
  demoMode,
  walletWarning,
}: {
  invoiceId: string;
  rails: PayoutRailOption[];
  netMinor: number;
  netCurrency: string;
  demoMode: boolean;
  walletWarning?: string | null;
}) {
  const router = useRouter();
  const defaultRail = rails.find((r) => r.isDefault) ?? rails[0];
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"rail" | "code">("rail");
  const [railId, setRailId] = useState(defaultRail?.id ?? "");
  const [payoutId, setPayoutId] = useState<string | null>(null);
  const [amountDisplay, setAmountDisplay] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [initiating, setInitiating] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const selected = rails.find((r) => r.id === railId) ?? null;
  const frozen = Boolean(walletWarning);

  function onOpenChange(next: boolean) {
    if (initiating || confirming) return;
    setOpen(next);
    if (!next) {
      // reset for the next attempt (the page re-renders with fresh state anyway)
      setStep("rail");
      setCode("");
      setPayoutId(null);
      setAmountDisplay(null);
    }
  }

  async function initiate() {
    if (initiating || !railId) return;
    setInitiating(true);
    try {
      const res = await initiatePayoutAction(invoiceId, railId);
      if (res.ok && res.data) {
        setPayoutId(res.data.payoutId);
        setAmountDisplay(res.data.amountDisplay);
        setStep("code");
      } else {
        toast.error(res.error ?? "Could not initiate the payout.");
      }
    } catch {
      toast.error("Could not initiate the payout. Please try again.");
    } finally {
      setInitiating(false);
    }
  }

  async function confirm() {
    if (confirming || !payoutId) return;
    setConfirming(true);
    try {
      const res = await fetch(`/api/payouts/${payoutId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok || !data || typeof data.error === "string") {
        toast.error(data?.error ?? "Wrong confirmation code.");
        return;
      }
      toast.success("Payout sent — watch it land in seconds.");
      setOpen(false);
      setStep("rail");
      setCode("");
      router.refresh();
    } catch {
      toast.error("Could not confirm the payout. Please try again.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Banknote data-icon="inline-start" />
          Pay out to M-Pesa
        </Button>
      </DialogTrigger>
      <DialogContent>
        {step === "rail" ? (
          <>
            <DialogHeader>
              <DialogTitle>Confirm payout</DialogTitle>
              <DialogDescription>
                You&apos;ll receive the net of this invoice — fees and FX are already
                accounted for in the waterfall.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
              <span className="text-xs text-muted-foreground">You&apos;ll receive</span>
              <Amount
                minor={netMinor}
                currency={netCurrency}
                className="text-2xl font-semibold"
              />
            </div>

            {frozen && (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>Payouts frozen on this wallet</AlertTitle>
                <AlertDescription>{walletWarning}</AlertDescription>
              </Alert>
            )}

            <Field>
              <FieldLabel>Destination</FieldLabel>
              {rails.length === 0 ? (
                <FieldDescription>
                  No payout rail yet — add your M-Pesa number or bank account in
                  Settings, then come back.
                </FieldDescription>
              ) : (
                <Select value={railId} onValueChange={setRailId} disabled={initiating}>
                  <SelectTrigger className="w-full" aria-label="Payout destination">
                    <SelectValue placeholder="Choose where the money goes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {rails.map((rail) => (
                        <SelectItem key={rail.id} value={rail.id}>
                          {railLabel(rail)}
                          {rail.isDefault && " · default"}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
              {selected && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {selected.rail === "mpesa" ? (
                    <Smartphone className="size-4 shrink-0" />
                  ) : (
                    <Landmark className="size-4 shrink-0" />
                  )}
                  <span>
                    {selected.rail === "mpesa"
                      ? selected.phone ?? "—"
                      : [selected.bankCode, selected.accountNumber].filter(Boolean).join(" · ") || "—"}
                    {selected.accountName ? ` (${selected.accountName})` : ""}
                  </span>
                </div>
              )}
            </Field>

            <DialogFooter>
              <Button onClick={initiate} disabled={initiating || !railId || frozen}>
                {initiating && <Spinner data-icon="inline-start" />}
                Initiate payout
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Confirmation code</DialogTitle>
              <DialogDescription>
                Last step before{" "}
                <span className="font-medium text-foreground">
                  {amountDisplay ?? "the payout"}
                </span>{" "}
                leaves your wallet.
              </DialogDescription>
            </DialogHeader>

            <Field>
              <FieldLabel htmlFor="payout-code">Code</FieldLabel>
              <Input
                id="payout-code"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                placeholder="••••••"
                className="font-mono tracking-widest"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={confirming}
                autoFocus
              />
              {demoMode ? (
                <FieldDescription className="flex items-center gap-1.5">
                  Demo code: <Badge className="font-mono">123456</Badge>
                </FieldDescription>
              ) : (
                <FieldDescription>
                  Sent to the phone number on your Payaza account.
                </FieldDescription>
              )}
            </Field>

            <DialogFooter>
              <Button onClick={confirm} disabled={confirming || code.trim().length < 4}>
                {confirming && <Spinner data-icon="inline-start" />}
                Confirm &amp; send money
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

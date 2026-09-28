"use client";

import { useState } from "react";
import { AlertCircle, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/**
 * Mobile-money prompt form (buyer-facing, public page). Network values are
 * MOMO_BANK_CODES keys (lib/payaza/endpoints): KE mpesa|airtel,
 * UG mtn|airtel, TZ vodacom|airtel|tigo. The server route derives the country
 * from the invoice currency; `country` here only drives the picker + hints.
 */

type MomoCountry = "KE" | "UG" | "TZ";

const NETWORKS: Record<MomoCountry, { value: string; label: string }[]> = {
  KE: [
    { value: "mpesa", label: "M-Pesa" },
    { value: "airtel", label: "Airtel Money" },
  ],
  UG: [
    { value: "mtn", label: "MTN MoMo" },
    { value: "airtel", label: "Airtel Money" },
  ],
  TZ: [
    { value: "vodacom", label: "M-Pesa (Vodacom)" },
    { value: "airtel", label: "Airtel Money" },
    { value: "tigo", label: "Tigo Pesa" },
  ],
};

const DIAL: Record<MomoCountry, { code: string; hint: string }> = {
  KE: { code: "+254", hint: "07XX XXX XXX" },
  UG: { code: "+256", hint: "07XX XXX XXX" },
  TZ: { code: "+255", hint: "06XX XXX XXX" },
};

export interface MomoFormProps {
  token: string;
  currency: string;
  country: MomoCountry;
  /** Formatted display amount, e.g. "KSh 12,500.00" (server-computed). */
  amountLabel: string;
  onSuccess: (msg: string) => void;
}

export function MomoForm({ token, country, amountLabel, onSuccess }: MomoFormProps) {
  const options = NETWORKS[country];
  const [network, setNetwork] = useState<string>(options[0]?.value ?? "mpesa");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const networkLabel = options.find((o) => o.value === network)?.label ?? "mobile money";
  const phoneInvalid = error !== null && phone.replace(/\D/g, "").length < 7;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (phone.replace(/\D/g, "").length < 7) {
      const msg = "Enter a valid mobile money number (e.g. 07XX XXX XXX)";
      setError(msg);
      toast.error(msg);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/buyer/momo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, phone, network }),
      });
      const data = (await res.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;
      if (!res.ok || !data || data.error) {
        throw new Error(data?.error ?? "We couldn't send the prompt. Please try again.");
      }
      // Parent switches to the pending view with the server's message.
      onSuccess(data.message ?? "Prompt sent. Approve it on your phone.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Field>
          <FieldTitle>Your mobile money network</FieldTitle>
          <ToggleGroup
            type="single"
            variant="outline"
            value={network}
            onValueChange={(v) => {
              if (v) {
                setNetwork(v);
                setError(null);
              }
            }}
            disabled={busy}
            aria-label="Mobile money network"
            className="w-full"
          >
            {options.map((o) => (
              <ToggleGroupItem key={o.value} value={o.value} className="flex-1 truncate">
                {o.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>

        <Field data-invalid={phoneInvalid || undefined}>
          <FieldLabel htmlFor="momo-phone">Mobile money number</FieldLabel>
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <InputGroupText className="font-mono">{DIAL[country].code}</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              id="momo-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={DIAL[country].hint}
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (error) setError(null);
              }}
              disabled={busy}
              required
              aria-invalid={phoneInvalid || undefined}
            />
          </InputGroup>
          <FieldDescription>The prompt will ask you to approve {amountLabel}.</FieldDescription>
        </Field>
      </FieldGroup>

      {error && (
        <Alert variant="destructive" className="mt-3">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={busy} className="mt-4 w-full sm:w-auto">
        {busy ? <Spinner data-icon="inline-start" /> : <Smartphone data-icon="inline-start" />}
        Send Payment Prompt
      </Button>

      <p className="mt-3 text-xs text-muted-foreground">
        You&apos;ll approve the prompt in your {networkLabel} app. Kusanya never sees your PIN.
      </p>
    </form>
  );
}

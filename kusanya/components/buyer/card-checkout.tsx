"use client";

import { useState } from "react";
import { AlertCircle, CreditCard, Info } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * Card checkout via the Payaza Checkout SDK popup (USD primary; Payaza also
 * supports KES/UGX/TZS cards, so this renders as a secondary option under
 * mobile money too). The SDK is dynamically imported on click so it stays out
 * of the initial bundle. The client callback is a HINT — /pay-done verifies
 * server-side before claiming success.
 */

export interface CardCheckoutProps {
  token: string;
  amountLabel: string;
  businessName: string;
  buyerEmail: string;
  buyerFirstName: string;
  buyerLastName: string;
  /** Hosted Payaza payment-link fallback (invoices.payazaLinkUrl). */
  payazaLinkUrl?: string | null;
  onDone: (merchantReference: string) => void;
}

export function CardCheckout({
  token,
  amountLabel,
  businessName,
  buyerEmail,
  buyerFirstName,
  buyerLastName,
  payazaLinkUrl,
  onDone,
}: CardCheckoutProps) {
  const [busy, setBusy] = useState(false);
  const [demoReason, setDemoReason] = useState<string | null>(null);
  const [noKeys, setNoKeys] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    setDemoReason(null);
    setNoKeys(false);
    setError(null);
    try {
      const res = await fetch("/api/buyer/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json().catch(() => null)) as
        | { demo?: boolean; reason?: string; sdkConfig?: Record<string, unknown>; merchantReference?: string; error?: string }
        | null;
      if (!res.ok || !data || data.error) {
        throw new Error(data?.error ?? "We couldn't start card checkout. Please try again.");
      }

      if (data.demo) {
        setDemoReason(
          data.reason ??
            "Card checkout needs Payaza sandbox keys. In Demo Mode, use the merchant-side 'Demo controls' or the mobile-money flow.",
        );
        return;
      }

      const merchantKey = String(data.sdkConfig?.merchant_key ?? "");
      if (!merchantKey || merchantKey === "pk_demo_placeholder") {
        setNoKeys(true);
        return;
      }

      // Dynamic import keeps the SDK out of the initial bundle.
      const { default: PayazaCheckout } = await import("payaza-web-sdk");
      // sdkConfig is built server-side (startCheckoutSession) and travels as
      // JSON, so it arrives loosely typed; the double assertion feeds it to
      // the SDK's own option type. Buyer details act as fallbacks — the
      // server-provided values in sdkConfig win via spread order.
      const options = {
        email_address: buyerEmail,
        first_name: buyerFirstName,
        last_name: buyerLastName,
        ...data.sdkConfig,
        onClose: () => {
          /* popup closed — verification happens on /pay-done */
        },
        callback: (cbResult: { type?: string; status?: number }) => {
          if (cbResult?.type === "success" || cbResult?.status === 201) {
            onDone(String(data.merchantReference ?? ""));
          }
        },
      } as unknown as Parameters<typeof PayazaCheckout.setup>[0];
      const checkout = PayazaCheckout.setup(options);
      checkout.showPopup();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-label={`Pay ${amountLabel} by card to ${businessName}`}
      >
        {busy ? <Spinner data-icon="inline-start" /> : <CreditCard data-icon="inline-start" />}
        Pay {amountLabel} By Card
      </Button>
      <p className="text-xs text-muted-foreground">
        Visa · Mastercard · Apple Pay · Google Pay, secured by Payaza Checkout
      </p>

      {demoReason && (
        <Alert>
          <Info />
          <AlertDescription>
            {demoReason}
            <span className="mt-1 block text-xs text-muted-foreground">
              Ask the merchant to use Demo controls, or pay by mobile money above if available.
            </span>
          </AlertDescription>
        </Alert>
      )}

      {noKeys && (
        <p className="text-xs text-muted-foreground">
          Card checkout isn&apos;t configured with Payaza keys yet
          {payazaLinkUrl ? ". Use the payment link below instead." : "."}
        </p>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {payazaLinkUrl && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Having trouble?</span>
          <Button variant="outline" size="sm" asChild>
            <a href={payazaLinkUrl} target="_blank" rel="noopener">
              Use The Payment Link Instead
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

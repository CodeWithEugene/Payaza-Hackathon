"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/invoices/status-badge";
import { CardCheckout } from "@/components/buyer/card-checkout";
import { MomoForm } from "@/components/buyer/momo-form";

/**
 * Buyer pay panel — method choice, momo-prompt waiting view (polled via
 * /api/buyer/status), and honest done/failed states. Card success navigates
 * to /pay-done, which verifies server-side with Payaza.
 */

type View = "choose" | "momo_pending" | "done" | "failed";

type MomoCountry = "KE" | "UG" | "TZ";

const CURRENCY_TO_COUNTRY: Record<string, MomoCountry> = {
  KES: "KE",
  UGX: "UG",
  TZS: "TZ",
};

/** Invoice statuses that mean "the money moved" (buyer-visible success). */
const DONE_STATUSES = ["paid", "partially_paid", "settling", "settled", "completed"];

/** Fast 4s polling for ~3 minutes, then slower so we don't hammer forever. */
const FAST_POLL_MS = 180_000;

interface BuyerStatusResponse {
  status: string;
  currency: string;
  amountMinor: string;
  transactions: unknown[];
}

export interface PayPanelProps {
  token: string;
  status: string;
  currency: string;
  amountMinor: string | number;
  amountLabel: string;
  businessName: string;
  buyerName: string;
  buyerEmail: string;
  demoMode: boolean;
  /** Real Payaza test rails: test cards / any phone number, no real money. */
  sandbox?: boolean;
  payazaLinkUrl?: string | null;
}

export function PayPanel(props: PayPanelProps) {
  // Self-contained QueryClient: the buyer page renders outside the merchant
  // app shell, so the panel must work whether or not a provider is mounted
  // higher up. A nested provider is harmless if one already exists.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 0, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <PayPanelInner {...props} />
    </QueryClientProvider>
  );
}

function PayPanelInner({
  token,
  status,
  currency,
  amountLabel,
  businessName,
  buyerName,
  buyerEmail,
  demoMode,
  sandbox = false,
  payazaLinkUrl,
}: PayPanelProps) {
  const router = useRouter();
  const [view, setView] = useState<View>("choose");
  const [pendingMsg, setPendingMsg] = useState<string | null>(null);
  const [slowNote, setSlowNote] = useState(false);
  // Lazily seeded in the pending effect; 0 keeps this render pure (no clock read).
  const pendingStartedAt = useRef<number>(0);

  const momoCountry: MomoCountry | null = CURRENCY_TO_COUNTRY[currency] ?? null;

  const { data } = useQuery<BuyerStatusResponse>({
    queryKey: ["buyer-status", token],
    queryFn: async () => {
      const res = await fetch(`/api/buyer/status?token=${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error("status check failed");
      return (await res.json()) as BuyerStatusResponse;
    },
    enabled: view === "momo_pending",
    refetchInterval: () => (Date.now() - pendingStartedAt.current < FAST_POLL_MS ? 4000 : 15000),
  });

  // Status shown to the buyer is a pure mirror of the latest poll (derived,
  // not copied into state — avoids a setState-in-effect cascade).
  const currentStatus = data?.status ?? status;

  // Polling clock starts when the pending view opens; after ~3 min we keep
  // updating (slower) and tell the buyer honestly that the page self-updates.
  useEffect(() => {
    if (view !== "momo_pending") return;
    pendingStartedAt.current = Date.now();
    const t = setTimeout(() => setSlowNote(true), FAST_POLL_MS);
    return () => clearTimeout(t);
  }, [view]);

  // React to the polled ledger flipping the payment to a terminal state —
  // legitimate external-store sync (the react-query cache). The two setView
  // calls are intentional; react-hooks/set-state-in-effect is a preview rule.
  useEffect(() => {
    if (!data?.status) return;
    if (DONE_STATUSES.includes(data.status)) setView("done");
    else if (data.status === "failed") setView("failed");
  }, [data]);

  const [buyerFirstName = "", ...rest] = buyerName.split(" ");
  const buyerLastName = rest.join(" ") || ".";
  const handleCardDone = (merchantReference: string) => {
    router.push(`/pay-done?ref=${encodeURIComponent(merchantReference)}`);
  };

  const cardCheckout = (
    <CardCheckout
      token={token}
      amountLabel={amountLabel}
      businessName={businessName}
      buyerEmail={buyerEmail}
      buyerFirstName={buyerFirstName}
      buyerLastName={buyerLastName}
      payazaLinkUrl={payazaLinkUrl}
      onDone={handleCardDone}
    />
  );

  if (view === "momo_pending") {
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <Spinner className="size-6" />
          <CardTitle>Waiting for you to approve the prompt…</CardTitle>
          {pendingMsg && <CardDescription>{pendingMsg}</CardDescription>}
        </CardHeader>
        <CardContent>
          <p className="text-center text-xs text-muted-foreground">
            {slowNote
              ? "Still pending — this page updates automatically; you can close it."
              : "This page updates itself as soon as your payment lands."}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (view === "done") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="size-8" />
          </span>
          <h2 className="text-lg font-semibold">Payment received — asante!</h2>
          <StatusBadge status={currentStatus} />
          <p className="text-sm text-muted-foreground">
            The merchant has been notified. A receipt is on its way by email.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (view === "failed") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <XCircle className="size-10 text-destructive" />
          <h2 className="text-lg font-semibold">The payment didn&apos;t go through.</h2>
          <p className="text-sm text-muted-foreground">
            Nothing is lost — pick a method and try once more.
          </p>
          <Button type="button" onClick={() => setView("choose")}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // view === "choose"
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pay this invoice</CardTitle>
        <CardDescription>
          {amountLabel}
          {momoCountry ? " — mobile money or card" : " — securely by card"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {momoCountry ? (
          <>
            <MomoForm
              token={token}
              currency={currency}
              country={momoCountry}
              amountLabel={amountLabel}
              onSuccess={(msg) => {
                setPendingMsg(msg);
                setView("momo_pending");
              }}
            />
            <Separator />
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium">Prefer card?</p>
              {cardCheckout}
            </div>
          </>
        ) : (
          cardCheckout
        )}
        {demoMode && (
          <p className="text-xs text-muted-foreground">
            Demo Mode is on — payments here are simulated. The merchant&apos;s Demo controls can
            complete or fail this payment instantly.
          </p>
        )}
        {sandbox && (
          <p className="text-xs text-muted-foreground">
            Payaza sandbox: this runs on Payaza&apos;s real test rails. Use a test card or any
            phone number. No real money moves.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

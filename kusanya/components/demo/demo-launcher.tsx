"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BarChart3,
  CircleAlert,
  CircleCheck,
  CreditCard,
  DatabaseZap,
  Lock,
  LogIn,
  ShieldAlert,
  Smartphone,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";

import { authClient } from "@/lib/auth/api-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";

interface DemoState {
  login: { email: string; password: string };
  invoiceIds: Record<string, string>;
}

interface Scenario {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Key into the reset response's invoiceIds; when absent, href is fixed. */
  invoiceKey?: string;
  /** Where the card points before demo data is loaded (or for fixed routes). */
  fallback: string;
}

const SCENARIOS: Scenario[] = [
  {
    invoiceKey: "completed",
    icon: CircleCheck,
    title: "The Full Story: Paid → Settled → KES In M-Pesa",
    description:
      "A USD card collection from start to payout, with the transparency waterfall and the confirmation gate.",
    fallback: "/app/invoices",
  },
  {
    invoiceKey: "sent",
    icon: Smartphone,
    title: "Live Mobile-Money Payment (Webhook Replay)",
    description:
      "An invoice out with the buyer. Replay the M-Pesa webhook and watch it move in real time.",
    fallback: "/app/invoices",
  },
  {
    icon: ShieldAlert,
    title: "Risk Queue: First-Time Buyer + Anomaly",
    description:
      "A borderline invoice waiting on a human, with every scored reason shown.",
    fallback: "/app/review",
  },
  {
    invoiceKey: "partial",
    icon: TriangleAlert,
    title: "Underpayment Alert (85% Received)",
    description:
      "The buyer paid short. See the alert, the shortfall math and the guardrail-checked follow-up.",
    fallback: "/app/invoices",
  },
  {
    invoiceKey: "hold",
    icon: Lock,
    title: "Sanctions Hold",
    description:
      "Screening froze this one before send, with the reason and the override trail.",
    fallback: "/app/invoices",
  },
  {
    icon: Users,
    title: "Partners & Automatic Splits",
    description:
      "Agents and partners get their share automatically as invoices settle.",
    fallback: "/app/partners",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description: "Collections, rails, fees and FX across the whole book.",
    fallback: "/app/analytics",
  },
];

export function DemoLauncher() {
  const router = useRouter();
  const [demo, setDemo] = useState<DemoState | null>(null);
  const [resetting, setResetting] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  async function onReset() {
    if (resetting) return;
    setResetting(true);
    setResetError(null);
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; login?: DemoState["login"]; invoiceIds?: Record<string, string> }
        | null;
      if (!res.ok || !body?.login) {
        const message =
          body?.error ?? "Demo reset failed. The server may not be in Demo Mode.";
        setResetError(message);
        toast.error(message);
        return;
      }
      setDemo({ login: body.login, invoiceIds: body.invoiceIds ?? {} });
      toast.success("Demo data loaded. FreshLeaf Exports is ready.");
    } catch {
      const message = "Couldn't reach the demo server. Is the app running?";
      setResetError(message);
      toast.error(message);
    } finally {
      setResetting(false);
    }
  }

  async function onSignIn() {
    if (!demo || signingIn) return;
    setSigningIn(true);
    const { error } = await authClient.signIn.email({
      email: demo.login.email,
      password: demo.login.password,
    });
    setSigningIn(false);
    if (error) {
      toast.error(
        error.message ?? "Demo sign-in failed. Load the demo data again.",
      );
      return;
    }
    toast.success("Signed in as Wanjiru.");
    router.push("/app");
    router.refresh();
  }

  function scenarioHref(scenario: Scenario): string {
    const id = scenario.invoiceKey
      ? demo?.invoiceIds[scenario.invoiceKey]
      : undefined;
    return id ? `/app/invoices/${id}` : scenario.fallback;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Step 1 — load + sign in */}
      <Card>
        <CardHeader>
          <CardAction>
            <Badge variant="secondary" className="font-mono">
              Step 1
            </Badge>
          </CardAction>
          <CardTitle>Load The Demo Data</CardTitle>
          <CardDescription>
            Wipes and reseeds the whole FreshLeaf Exports story: invoices,
            buyers, transactions and payouts. Takes a few seconds.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {resetError ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>Reset Didn&apos;t Finish</AlertTitle>
              <AlertDescription>{resetError}</AlertDescription>
            </Alert>
          ) : null}
          <Button
            size="lg"
            className="w-full"
            onClick={onReset}
            disabled={resetting}
          >
            {resetting ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <DatabaseZap data-icon="inline-start" />
            )}
            {resetting ? "Reseeding The Story…" : "Load Demo Data"}
          </Button>
        </CardContent>
        {demo ? (
          <CardFooter className="flex-col items-stretch gap-3">
            <div className="bg-background flex flex-col gap-1 rounded-lg p-3 font-mono text-xs ring-1 ring-foreground/10">
              <span>{demo.login.email}</span>
              <span>{demo.login.password}</span>
            </div>
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={onSignIn}
              disabled={signingIn}
            >
              {signingIn ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <LogIn data-icon="inline-start" />
              )}
              {signingIn ? "Signing In…" : "Fill & Sign In"}
            </Button>
          </CardFooter>
        ) : null}
      </Card>

      <Separator />

      {/* Step 2 — scenarios */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono">
            Step 2
          </Badge>
          <h2 className="font-heading text-base font-medium">
            Jump Into A Scene
          </h2>
        </div>
        <p className="text-muted-foreground text-sm">
          Load the demo data first. Each card then deep-links to the exact
          invoice in that moment of the story.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {SCENARIOS.map((scenario) => (
            <Link
              key={scenario.title}
              href={scenarioHref(scenario)}
              className="group flex min-w-0"
            >
              <Card
                size="sm"
                className="w-full transition-colors group-hover:bg-accent/50"
              >
                <CardHeader>
                  <CardAction>
                    <scenario.icon className="text-muted-foreground size-4 transition-colors group-hover:text-foreground" />
                  </CardAction>
                  <CardTitle>{scenario.title}</CardTitle>
                  <CardDescription>{scenario.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <Separator />

      {/* Payaza test facts */}
      <Alert>
        <CreditCard />
        <AlertTitle>Payaza Test Card & Payout Code</AlertTitle>
        <AlertDescription>
          <span className="flex flex-col gap-1">
            <span>
              Visa{" "}
              <span className="font-mono text-foreground">4508750015741019</span>{" "}
              with expiry <span className="font-mono text-foreground">01/39</span>{" "}
              approves, <span className="font-mono text-foreground">05/39</span>{" "}
              declines. Any CVC.
            </span>
            <span>
              Demo payout confirmation code:{" "}
              <span className="font-mono text-foreground">123456</span>
            </span>
          </span>
        </AlertDescription>
      </Alert>
    </div>
  );
}

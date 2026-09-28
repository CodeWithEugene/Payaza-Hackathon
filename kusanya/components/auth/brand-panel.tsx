import Link from "next/link";
import { MessageCircle, ShieldCheck, Wallet } from "lucide-react";

import { KusanyaMark } from "@/components/brand/logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const POINTS = [
  {
    icon: MessageCircle,
    title: "Telegram Order To Invoice In Seconds",
    body: "Jev AI reads the message; deterministic code resolves every number and date. You review before anything is sent.",
  },
  {
    icon: ShieldCheck,
    title: "Screened Before It's Sent",
    body: "A fail-closed risk screen runs on every invoice — anything uncertain waits in the review queue, not in your sent folder.",
  },
  {
    icon: Wallet,
    title: "KES In Your M-Pesa",
    body: "USD cards and East African mobile money in; a confirmation-code gate pays you out. Nothing moves without you.",
  },
];

/**
 * BrandPanel — the left half of the split auth pages (shadcn auth-block
 * pattern). Brand, the signature transparency waterfall with the canonical
 * seeded numbers (USD 1,150.00 → KES 143,237.55 gross → 138,260.04 net,
 * the same figures the landing page shows), three value points, and an
 * honest demo-mode footer for judges. Hidden below lg — mobile keeps the
 * compact centered brand row above the form.
 */
export function BrandPanel({ sandbox = false }: { sandbox?: boolean }) {
  return (
    <div className="bg-muted/50 relative hidden flex-col justify-between gap-10 p-10 lg:flex xl:p-14">
      {/* Brand */}
      <Link href="/" className="flex w-fit items-center gap-2.5">
        <KusanyaMark className="size-9" />
        <span className="font-heading text-xl font-semibold tracking-tight">
          kusanya
        </span>
      </Link>

      {/* Value prop + proof */}
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance xl:text-4xl">
            Invoice-first international collections for Kenyan exporters
          </h2>
          <p className="text-muted-foreground max-w-md text-pretty">
            A Telegram order becomes a screened, sent and settled invoice,
            with every fee and the FX rate shown before you hit send.
          </p>
        </div>

        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-sm">
              A settled invoice, fully transparent
            </CardTitle>
            <CardDescription>
              KSN-2026-0003 · FreshLeaf Exports Ltd · USD → KES
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Buyer pays</span>
              <span className="font-mono tabular-nums">USD 1,150.00</span>
            </div>
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="text-muted-foreground">
                Converted at the shown rate
              </span>
              <span className="font-mono tabular-nums">KES 143,237.55</span>
            </div>
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="text-muted-foreground">
                Fees &amp; FX margin, itemised
              </span>
              <span className="font-mono tabular-nums">−KES 4,977.51</span>
            </div>
            <div className="border-border flex items-baseline justify-between gap-4 border-t pt-2.5">
              <span className="text-sm font-medium">Net to your M-Pesa</span>
              <span className="font-mono text-base font-semibold tabular-nums">
                KES 138,260.04
              </span>
            </div>
          </CardContent>
        </Card>

        <ul className="flex max-w-md flex-col gap-5">
          {POINTS.map((point) => (
            <li key={point.title} className="flex items-start gap-3">
              <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
                <point.icon className="size-4" />
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{point.title}</span>
                <span className="text-muted-foreground text-sm text-pretty">
                  {point.body}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Judges footer */}
      <p className="text-muted-foreground max-w-md text-xs">
        Built on Payaza · Borderless Kenya Hackathon, Track 03.{" "}
        {sandbox
          ? "This demo runs on Payaza's real sandbox rails with test money; no real money moves."
          : "This demo runs in Demo Mode with synthetic payloads; no real money moves."}
      </p>
    </div>
  );
}

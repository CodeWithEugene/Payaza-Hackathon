import Link from "next/link";
import { MessageCircle, ShieldCheck, Wallet } from "lucide-react";

import { KusanyaMark } from "@/components/brand/logo";
import { ProductMock } from "@/components/landing/product-mock";

const POINTS = [
  {
    icon: MessageCircle,
    title: "Telegram Order To Invoice In Seconds",
    body: "Jev AI reads the message and code resolves every number and date. You confirm before anything is sent.",
  },
  {
    icon: ShieldCheck,
    title: "Screened Before It's Sent",
    body: "A fail-closed risk screen runs on every invoice. Anything uncertain waits in the review queue, not in your sent folder.",
  },
  {
    icon: Wallet,
    title: "KES In Your M-Pesa",
    body: "USD cards and East African mobile money in, KES out after your confirmation code. Nothing moves without you.",
  },
];

/**
 * BrandPanel: the left half of the split auth pages. Dark indigo panel with
 * the landing hero's animated gradient ribbon and its floating product mock
 * (the seeded USD 1,150 → KES 138,260.04 story). Hidden below lg; mobile
 * keeps the compact brand row above the form.
 */
export function BrandPanel({ sandbox = false }: { sandbox?: boolean }) {
  return (
    <div className="k-ink-glow text-brand-ink-foreground relative isolate hidden flex-col justify-between gap-10 overflow-hidden p-10 lg:flex xl:p-14">
      {/* Animated brand ribbon, same gradient as the landing hero. */}
      <div aria-hidden="true" className="k-hero-band pointer-events-none absolute inset-x-0 top-0 -z-10 h-[40%] opacity-90">
        <div className="k-hero-gradient absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--brand-ink)]" />
      </div>

      <Link href="/" className="flex w-fit items-center gap-2.5">
        <span className="k-brand-tile flex size-10 items-center justify-center rounded-xl">
          <KusanyaMark className="size-6" />
        </span>
        <span className="font-heading text-xl font-semibold tracking-tight">kusanya</span>
      </Link>

      <div className="flex flex-col gap-10">
        <div className="flex max-w-lg flex-col gap-3">
          <h2 className="font-heading text-4xl font-bold tracking-tight text-balance [text-shadow:0_2px_24px_rgb(15_18_49/0.35)] xl:text-5xl">
            Get Paid For Your Exports, Without The Chase
          </h2>
          <p className="text-lg text-pretty text-white/90 [text-shadow:0_1px_14px_rgb(15_18_49/0.55)]">
            A Telegram order becomes a screened, sent and settled invoice, with every fee and the FX rate shown
            before you hit send.
          </p>
        </div>

        <div className="max-w-lg text-foreground">
          <ProductMock />
        </div>

        <ul className="grid max-w-2xl gap-5 xl:grid-cols-3">
          {POINTS.map((point) => (
            <li key={point.title} className="flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white ring-1 ring-white/15">
                <point.icon className="size-4" />
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">{point.title}</span>
                <span className="text-brand-ink-muted text-sm text-pretty">{point.body}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-brand-ink-muted max-w-lg text-xs">
        Built on Payaza · Borderless Kenya Hackathon, Track 03.{" "}
        {sandbox
          ? "This demo runs on Payaza's real sandbox rails with test money; no real money moves."
          : "This demo runs in Demo Mode with synthetic payloads; no real money moves."}
      </p>
    </div>
  );
}

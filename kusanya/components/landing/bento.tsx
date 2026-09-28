import {
  Accessibility,
  ArrowRight,
  Bot,
  ReceiptText,
  ScrollText,
  ShieldCheck,
  Split,
  Wallet,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import {
  A11Y_OPTIONS,
  AGENT_SPLIT,
  DEMO_BUYER_MESSAGE,
  EXTRACTED_FIELDS,
  NET_PAYOUT,
  RISK_SIGNALS,
  WATERFALL_ROWS,
} from "./data"
import { SectionHeading } from "./section-heading"

type Tone = "violet" | "sunset" | "coral" | "lagoon" | "leaf" | "rose"

const TONES: Record<Tone, { chip: string; glow: string }> = {
  violet: {
    chip: "bg-brand-violet/12 text-brand-violet",
    glow: "bg-brand-violet",
  },
  sunset: {
    chip: "bg-brand-sunset/12 text-brand-sunset",
    glow: "bg-brand-sunset",
  },
  coral: { chip: "bg-brand-coral/12 text-brand-coral", glow: "bg-brand-coral" },
  lagoon: {
    chip: "bg-brand-lagoon/12 text-brand-lagoon",
    glow: "bg-brand-lagoon",
  },
  leaf: { chip: "bg-brand-leaf/12 text-brand-leaf", glow: "bg-brand-leaf" },
  rose: { chip: "bg-brand-rose/12 text-brand-rose", glow: "bg-brand-rose" },
}

type TileProps = {
  icon: LucideIcon
  tone: Tone
  kicker: string
  title: string
  description: string
  className?: string
  children?: React.ReactNode
}

function Tile({
  icon: Icon,
  tone,
  kicker,
  title,
  description,
  className,
  children,
}: TileProps) {
  return (
    <li
      className={cn(
        "relative isolate flex flex-col gap-5 overflow-hidden rounded-2xl bg-card p-6 text-card-foreground ring-1 ring-foreground/10 transition-shadow hover:shadow-lg md:p-7",
        className
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -top-16 -right-16 -z-10 size-48 rounded-full opacity-15 blur-3xl dark:opacity-20",
          TONES[tone].glow
        )}
      />
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-xl",
            TONES[tone].chip
          )}
        >
          <Icon className="size-4.5" />
        </span>
        <span className="text-sm font-medium text-muted-foreground">
          {kicker}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="font-heading text-xl font-semibold tracking-tight text-balance md:text-2xl">
          {title}
        </h3>
        <p className="leading-relaxed text-pretty text-muted-foreground">
          {description}
        </p>
      </div>
      {children ? <div className="mt-auto">{children}</div> : null}
    </li>
  )
}

function ExtractionVisual() {
  return (
    <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
      <p className="rounded-2xl rounded-tl-sm bg-muted px-3.5 py-3 text-sm leading-relaxed">
        {DEMO_BUYER_MESSAGE}
      </p>
      <ArrowRight
        aria-hidden="true"
        className="mx-auto size-5 rotate-90 text-brand-violet sm:rotate-0"
      />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl p-3.5 text-sm ring-1 ring-foreground/10">
        {EXTRACTED_FIELDS.map((field) => (
          <div key={field.label} className="flex min-w-0 flex-col">
            <dt className="text-xs text-muted-foreground">{field.label}</dt>
            <dd className="truncate font-medium">{field.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/* Deduction segments as a share of the gross in KES (1,150 × 128.90 =
   148,235). True proportions: small fees stay small, which is the point. */
const WATERFALL_SEGMENTS = [
  { label: "To your M-Pesa", pct: 93.27, className: "bg-brand-leaf" },
  { label: "Payaza card fee", pct: 1.9, className: "bg-brand-sunset" },
  { label: "Kusanya fee", pct: 1.47, className: "bg-brand-violet" },
  { label: "Agent split", pct: 2.42, className: "bg-brand-lagoon" },
  { label: "Payout fee", pct: 0.94, className: "bg-brand-rose" },
] as const

const ROW_DOT: Record<string, string | undefined> = {
  "Card processing fee": "bg-brand-sunset",
  "Kusanya fee": "bg-brand-violet",
  "Agent split": "bg-brand-lagoon",
  "Payout fee": "bg-brand-rose",
}

function WaterfallVisual() {
  return (
    <div className="flex flex-col gap-4">
      <div
        role="img"
        aria-label="Of a USD 1,150 invoice, 93.3% reaches your M-Pesa. Fees and the agent split take the remaining 6.7%."
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
      >
        {WATERFALL_SEGMENTS.map((segment) => (
          <span
            key={segment.label}
            className={cn("h-full min-w-1", segment.className)}
            style={{ width: `${segment.pct}%` }}
          />
        ))}
      </div>
      <dl className="flex flex-col gap-2.5 text-sm">
        {WATERFALL_ROWS.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-3"
          >
            <dt className="flex min-w-0 items-baseline gap-2 text-muted-foreground">
              <span
                aria-hidden="true"
                className={cn(
                  "size-2 shrink-0 translate-y-[-1px] rounded-full",
                  ROW_DOT[row.label] ?? "bg-border"
                )}
              />
              <span>
                {row.label}
                <span className="ml-1.5 text-xs">({row.note})</span>
              </span>
            </dt>
            <dd className="shrink-0 font-mono tabular-nums">{row.value}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
          <dt className="flex items-baseline gap-2 font-medium">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full bg-brand-leaf"
            />
            To your M-Pesa
          </dt>
          <dd className="font-mono text-lg font-semibold tabular-nums">
            {NET_PAYOUT}
          </dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">
        Illustrative figures from the live demo. Yours update as Payaza confirms
        each step.
      </p>
    </div>
  )
}

export function Bento() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="mx-auto flex w-full max-w-[110rem] scroll-mt-8 flex-col gap-12 px-4 py-20 md:px-8 lg:px-12 2xl:px-16 md:py-28"
    >
      <SectionHeading
        id="features-heading"
        eyebrow="Features"
        title="Everything Between The Order And The Payout"
        intro="AI where it saves you typing, deterministic code wherever money is counted, and checks everywhere it matters."
      />
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        <Tile
          icon={Bot}
          tone="violet"
          kicker="Telegram To Invoice AI"
          title="Paste A Chat, Get A Clean Invoice"
          description="Jev reads the buyer's message and proposes every field with a confidence band. Code, not the model, does the arithmetic, and you confirm before anything is sent."
          className="md:col-span-2"
        >
          <ExtractionVisual />
        </Tile>
        <Tile
          icon={ReceiptText}
          tone="sunset"
          kicker="Transparent Fee Waterfall"
          title="Know The Exact KES Before You Send"
          description="One invoice, every deduction, the real FX rate. Nothing hidden, nothing discovered later."
          className="md:col-span-2 lg:col-span-1 lg:row-span-2"
        >
          <WaterfallVisual />
        </Tile>
        <Tile
          icon={Wallet}
          tone="leaf"
          kicker="M-Pesa Payouts"
          title="KES Where You Already Bank"
          description="Payouts go to M-Pesa or your bank account, estimated up front and exact once Payaza confirms."
        >
          <p className="flex items-center justify-between gap-3 rounded-xl bg-brand-leaf/10 px-3.5 py-3 text-sm">
            <span>M-Pesa payout</span>
            <span className="shrink-0 font-mono font-semibold whitespace-nowrap tabular-nums">
              {NET_PAYOUT}
            </span>
          </p>
        </Tile>
        <Tile
          icon={Split}
          tone="lagoon"
          kicker="Automatic Agent Splits"
          title="Your Agent Is Paid In The Same Settlement"
          description="Clearing agents and brokers get their cut through Payaza split settlement. No separate transfer, no chasing."
        >
          <p className="flex items-center justify-between gap-3 rounded-xl bg-brand-lagoon/10 px-3.5 py-3 text-sm">
            <span>Mwalimu Logistics Ltd, 2.5%</span>
            <span className="shrink-0 font-mono font-semibold whitespace-nowrap tabular-nums">
              {AGENT_SPLIT}
            </span>
          </p>
        </Tile>
        <Tile
          icon={ShieldCheck}
          tone="coral"
          kicker="Risk Screening"
          title="Every Invoice Screened, Nobody Silently Blocked"
          description="Several signals are scored together. Anything borderline lands in a human review queue with the reasons spelled out."
        >
          <ul className="flex flex-wrap gap-1.5" aria-label="Signals scored">
            {RISK_SIGNALS.map((signal) => (
              <li key={signal}>
                <Badge variant="outline">{signal}</Badge>
              </li>
            ))}
          </ul>
        </Tile>
        <Tile
          icon={Accessibility}
          tone="rose"
          kicker="Accessibility"
          title="Built For Every Exporter"
          description="The accessibility menu in the corner of every page is saved per browser and applies before the page paints."
        >
          <ul
            className="flex flex-wrap gap-1.5"
            aria-label="Accessibility options"
          >
            {A11Y_OPTIONS.map((option) => (
              <li key={option}>
                <Badge variant="outline">{option}</Badge>
              </li>
            ))}
          </ul>
        </Tile>
        <Tile
          icon={ScrollText}
          tone="violet"
          kicker="Guardrails And Audit Trail"
          title="Every Action Leaves A Receipt"
          description="Reminders are drafted by Jev in your tone and guardrail-checked: no threats, no wrong figures, nothing sent until you approve. Every AI or human action is logged with its before and after state."
          className="md:col-span-2 lg:col-span-1"
        />
      </ul>
    </section>
  )
}

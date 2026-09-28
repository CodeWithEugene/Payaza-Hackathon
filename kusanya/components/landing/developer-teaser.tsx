import Link from "next/link"
import { ArrowRight, Braces, Webhook } from "lucide-react"

import { Button } from "@/components/ui/button"

import { Eyebrow } from "./section-heading"

const SNIPPET = [
  {
    text: "// Turn a buyer's chat message into invoice fields",
    tone: "comment",
  },
  { text: 'const res = await fetch("https://kusanya.codewitheugene.top/api/v1/extract", {', tone: "code" },
  { text: '  method: "POST",', tone: "code" },
  { text: "  headers: {", tone: "code" },
  { text: '    Authorization: "Bearer ksn_test_…",', tone: "string" },
  { text: '    "Content-Type": "application/json",', tone: "code" },
  { text: "  },", tone: "code" },
  { text: "  body: JSON.stringify({", tone: "code" },
  { text: '    text: "500kg French beans at USD 2.30/kg, total USD 1,150",', tone: "string" },
  { text: "  }),", tone: "code" },
  { text: "});", tone: "code" },
  { text: "", tone: "code" },
  { text: "const { data } = await res.json();", tone: "code" },
  { text: "// data.buyer, data.total, data.currency, data.due_date:", tone: "comment" },
  { text: "// each with a value, a confidence and its source snippet", tone: "comment" },
] as const

const TONE_CLASS: Record<(typeof SNIPPET)[number]["tone"], string> = {
  comment: "text-brand-ink-muted",
  code: "text-brand-ink-foreground",
  string: "text-hero-sun",
}

const POINTS = [
  {
    icon: Braces,
    title: "Typed Extraction",
    description:
      "Jev returns structured fields with confidence bands, never free text to parse.",
  },
  {
    icon: Webhook,
    title: "Signed Webhooks",
    description:
      "Payaza events are signature-verified before any invoice changes state.",
  },
] as const

export function DeveloperTeaser() {
  return (
    <section
      aria-labelledby="developers-heading"
      className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 py-20 md:px-8 md:py-28 lg:grid-cols-2 lg:gap-16"
    >
      <div className="flex flex-col gap-6">
        <Eyebrow>For Developers</Eyebrow>
        <h2
          id="developers-heading"
          className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl"
        >
          The Same Engine, Ready For Your Stack
        </h2>
        <p className="text-lg text-pretty text-muted-foreground">
          Kusanya runs on plain HTTP routes: extraction, invoices, payment
          status and Payaza webhooks. Wire the collections flow into your own
          ERP or order system.
        </p>
        <ul className="grid gap-5 sm:grid-cols-2">
          {POINTS.map((point) => (
            <li key={point.title} className="flex flex-col gap-2">
              <point.icon className="size-5 text-primary" aria-hidden="true" />
              <h3 className="font-semibold">{point.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {point.description}
              </p>
            </li>
          ))}
        </ul>
        <div>
          <Button
            size="lg"
            className="h-11 rounded-full px-6 text-base"
            asChild
          >
            <Link href="/developers">
              Read The Developer Docs
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </div>

      <figure className="min-w-0 overflow-hidden rounded-2xl bg-brand-ink shadow-2xl ring-1 ring-foreground/10 dark:ring-white/10">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full bg-hero-coral"
          />
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full bg-hero-sun"
          />
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full bg-brand-leaf"
          />
          <figcaption className="ml-2 font-mono text-xs text-brand-ink-muted">
            extract.ts
          </figcaption>
        </div>
        <pre
          tabIndex={0}
          aria-label="Example code: calling the invoice extraction endpoint"
          className="overflow-x-auto p-5 font-mono text-[0.8rem] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:text-sm"
        >
          <code>
            {SNIPPET.map((line, index) => (
              <span key={index} className={`block ${TONE_CLASS[line.tone]}`}>
                {line.text || " "}
              </span>
            ))}
          </code>
        </pre>
      </figure>
    </section>
  )
}

import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { KusanyaMark } from "@/components/brand/logo"
import { ModeToggle } from "@/components/mode-toggle"

import { ProductMock } from "./product-mock"

const NAV_LINKS = [
  { href: "#how-it-works", label: "How It Works" },
  { href: "#features", label: "Features" },
  { href: "/developers", label: "Developers" },
  { href: "/demo", label: "Live Demo" },
] as const

/** Overlays the top of the hero band (absolute), so it stays a page-level
 * banner landmark outside <main>. */
export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-40">
      <div className="mx-auto flex w-full max-w-[110rem] items-center justify-between gap-3 px-4 py-4 md:px-8 lg:px-12 2xl:px-16">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <KusanyaMark className="size-8" />
          <span className="font-heading text-xl font-semibold tracking-tight max-[380px]:sr-only">
            kusanya
          </span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <Button key={link.href} variant="ghost" asChild>
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
        </nav>
        <div className="flex items-center gap-1 rounded-full bg-background/80 p-1 ring-1 ring-foreground/10 backdrop-blur-md">
          <ModeToggle />
          <Button variant="ghost" className="rounded-full" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
          <Button className="rounded-full" asChild>
            <Link href="/signup">
              Start Free
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}

export function Hero() {
  return (
    <div className="relative isolate overflow-hidden pt-18">
      {/* Animated gradient band with a skewed lower edge, then a wash so copy
          always sits on a near-solid surface. */}
      <div
        aria-hidden="true"
        className="k-hero-band pointer-events-none absolute inset-x-0 top-0 -z-10 h-full"
      >
        <div className="k-hero-gradient absolute inset-0" />
        <div className="k-hero-wash absolute inset-0" />
      </div>

      <section
        aria-labelledby="hero-heading"
        className="mx-auto grid w-full max-w-[110rem] items-center gap-12 px-4 pt-8 pb-20 md:px-8 lg:px-12 2xl:px-16 md:pt-12 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pt-16 lg:pb-32"
      >
        <div className="flex flex-col items-start gap-6">
          <Badge
            variant="outline"
            className="h-auto gap-1.5 bg-background/70 px-3 py-1 text-xs whitespace-normal backdrop-blur"
          >
            <Sparkles className="text-primary" />
            Built on Payaza for Borderless Kenya, Track 03
          </Badge>
          <h1
            id="hero-heading"
            className="font-heading text-[2.6rem] leading-[1.02] font-semibold tracking-tighter text-balance sm:text-6xl lg:text-7xl 2xl:text-8xl"
          >
            Get Paid For Your Exports,{" "}
            <span className="text-primary">Without The Chase</span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-pretty sm:text-xl 2xl:max-w-2xl 2xl:text-2xl">
            A buyer&apos;s Telegram order becomes a clean invoice in seconds.
            Buyers abroad pay USD by card, Apple Pay or Google Pay, and regional
            buyers pay by mobile money. You receive KES in M-Pesa or your bank,
            with every fee and the FX rate shown before you hit send.
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button
              size="lg"
              className="h-11 rounded-full px-6 text-base"
              asChild
            >
              <Link href="/signup">
                Start Free
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 rounded-full px-6 text-base"
              asChild
            >
              <Link href="/demo">See The Live Demo</Link>
            </Button>
          </div>
          <p className="text-sm">
            1.5% platform fee. Payaza fees passed through at cost.
          </p>
          <a
            href="#ussd"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-background/80 px-4 py-2 text-sm ring-1 ring-foreground/10 backdrop-blur transition-colors hover:bg-background"
          >
            <span className="text-muted-foreground">No smartphone? Dial</span>
            <span className="font-mono font-semibold tracking-tight text-primary">*384*11400#</span>
          </a>
        </div>

        <ProductMock />
      </section>
    </div>
  )
}

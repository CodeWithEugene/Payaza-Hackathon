import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { KusanyaMark } from "@/components/brand/logo"

export function FinalCta() {
  return (
    <section
      aria-labelledby="cta-heading"
      className="px-4 pb-20 md:px-8 md:pb-28"
    >
      <div className="relative isolate mx-auto w-full max-w-7xl overflow-hidden rounded-3xl ring-1 ring-foreground/10">
        <div
          aria-hidden="true"
          className="k-hero-gradient absolute inset-0 -z-20"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-background/85 md:bg-transparent md:bg-linear-to-r md:from-background/95 md:via-background/80 md:to-background/10"
        />
        <div className="flex flex-col items-start gap-6 px-6 py-16 md:px-12 md:py-20">
          <h2
            id="cta-heading"
            className="max-w-2xl font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl"
          >
            Send Your Next Export Invoice With Kusanya
          </h2>
          <p className="max-w-xl text-lg text-pretty">
            Create an account in a minute, or open the live demo and follow a
            USD 1,150 order from Telegram message to KES in M-Pesa.
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
        </div>
      </div>
    </section>
  )
}

const FOOTER_LINKS = [
  { href: "/login", label: "Sign In" },
  { href: "/signup", label: "Create Account" },
  { href: "/demo", label: "Live Demo" },
  { href: "/developers", label: "Developers" },
] as const

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      {/* Right padding keeps links clear of the fixed help and accessibility dock. */}
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 pb-28 md:flex-row md:items-center md:justify-between md:px-8 md:pr-24 md:pb-10">
        <div className="flex items-start gap-3">
          <KusanyaMark className="size-7" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">
              Kusanya · Team Technetians · Payaza × Hackhouse Borderless Kenya
            </span>
            <span className="text-sm text-muted-foreground">
              Invoice-first international collections for Kenyan SME exporters.
            </span>
          </div>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-sm text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}

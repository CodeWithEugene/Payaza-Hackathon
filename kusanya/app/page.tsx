import type { Metadata } from "next"

import { Bento } from "@/components/landing/bento"
import { FinalCta, SiteFooter } from "@/components/landing/closing"
import { DeveloperTeaser } from "@/components/landing/developer-teaser"
import { Hero, SiteHeader } from "@/components/landing/hero"
import { HowItWorks } from "@/components/landing/how-it-works"
import { Rails } from "@/components/landing/rails"
import { StatsBand } from "@/components/landing/stats-band"
import { TrustStrip } from "@/components/landing/trust-strip"
import { UssdSection } from "@/components/landing/ussd-section"

export const metadata: Metadata = {
  title: { absolute: "Kusanya: Invoice-First International Collections" },
  description:
    "Turn buyer orders from Telegram, USSD or SMS into paid invoices. Buyers abroad pay by card, Apple Pay, Google Pay or mobile money, and you receive KES in M-Pesa with every fee shown. Built on Payaza.",
}

/**
 * Public landing page. A Server Component end to end: the only animation is
 * CSS (the hero gradient and floating mock in globals.css), and it stops for
 * prefers-reduced-motion and the in-app "Reduce motion" preference.
 */
export default function LandingPage() {
  return (
    <div className="relative flex min-h-svh flex-col overflow-x-clip bg-background text-foreground">
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <Hero />
        <TrustStrip />
        <HowItWorks />
        <Bento />
        <UssdSection />
        <Rails />
        <div className="py-20 md:py-28">
          <StatsBand />
        </div>
        <DeveloperTeaser />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  )
}

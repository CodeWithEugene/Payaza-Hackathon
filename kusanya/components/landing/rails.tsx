import {
  Apple,
  Banknote,
  CreditCard,
  Signal,
  Smartphone,
  SmartphoneNfc,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"

import { SectionHeading } from "./section-heading"

const RAILS = [
  {
    icon: CreditCard,
    title: "Visa And Mastercard",
    description:
      "A hosted checkout link your international buyer pays in seconds, settled in dollars.",
    currencies: ["USD"],
    tone: "text-brand-violet bg-brand-violet/12",
  },
  {
    icon: Apple,
    title: "Apple Pay",
    description:
      "One tap on an iPhone. The buyer's wallet handles the rest, so checkout abandonment drops.",
    currencies: ["USD"],
    tone: "text-brand-violet bg-brand-violet/12",
  },
  {
    icon: SmartphoneNfc,
    title: "Google Pay",
    description:
      "Android buyers pay straight from their wallet without digging out card details.",
    currencies: ["USD"],
    tone: "text-brand-violet bg-brand-violet/12",
  },
  {
    icon: Smartphone,
    title: "M-Pesa In Kenya",
    description:
      "STK push to your Kenyan buyers, confirmed by webhook the moment they enter their PIN.",
    currencies: ["KES"],
    tone: "text-brand-leaf bg-brand-leaf/12",
  },
  {
    icon: Signal,
    title: "MTN And Airtel In Uganda",
    description:
      "Mobile money collections from Ugandan buyers on both major networks.",
    currencies: ["UGX"],
    tone: "text-brand-sunset bg-brand-sunset/12",
  },
  {
    icon: Banknote,
    title: "M-Pesa And Tigo Pesa In Tanzania",
    description:
      "Mobile money collections from Tanzanian buyers, reconciled against the same invoice.",
    currencies: ["TZS"],
    tone: "text-brand-lagoon bg-brand-lagoon/12",
  },
] as const

export function Rails() {
  return (
    <section
      aria-labelledby="rails-heading"
      className="border-y border-border/70 bg-muted/40"
    >
      <div className="mx-auto grid w-full max-w-[110rem] gap-12 px-4 py-20 md:px-8 lg:px-12 2xl:px-16 md:py-28 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <SectionHeading
          id="rails-heading"
          eyebrow="Payment Rails"
          title="One Invoice, Every Rail Your Buyer Has"
          intro="Cards and wallets for international buyers, mobile money for the region, all on the same invoice link."
        />
        <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2">
          {RAILS.map((rail) => (
            <li key={rail.title} className="flex gap-4">
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${rail.tone}`}
              >
                <rail.icon className="size-5" />
              </span>
              <div className="flex flex-col gap-2">
                <h3 className="font-heading font-semibold tracking-tight">
                  {rail.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {rail.description}
                </p>
                <div className="flex gap-1.5">
                  {rail.currencies.map((currency) => (
                    <Badge
                      key={currency}
                      variant="outline"
                      className="font-mono"
                    >
                      {currency}
                    </Badge>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

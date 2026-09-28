import { CreditCard, FileText, Send, Wallet } from "lucide-react"

import { SectionHeading } from "./section-heading"

const STEPS = [
  {
    icon: Send,
    tone: "text-brand-lagoon bg-brand-lagoon/12",
    title: "A Buyer Messages Your Telegram Bot",
    description:
      "The order lands in Kusanya, or you paste it in. Jev AI reads it, and deterministic code resolves every number: quantities, unit prices, totals, due dates.",
    note: "No templates to maintain, nothing to retype.",
  },
  {
    icon: FileText,
    tone: "text-brand-violet bg-brand-violet/12",
    title: "Kusanya Screens And Sends The Invoice",
    description:
      "Every invoice is risk-screened before it goes out, with a Payaza payment link attached and the fees worked out up front.",
    note: "Borderline cases wait for a human, not an auto-block.",
  },
  {
    icon: CreditCard,
    tone: "text-brand-sunset bg-brand-sunset/12",
    title: "Your Buyer Pays Their Way",
    description:
      "Buyers abroad pay USD by Visa, Mastercard, Apple Pay or Google Pay. Regional buyers pay KES, UGX or TZS by M-Pesa, MTN, Airtel or Tigo Pesa.",
    note: "One link, every rail, the same invoice.",
  },
  {
    icon: Wallet,
    tone: "text-brand-leaf bg-brand-leaf/12",
    title: "KES Lands In Your M-Pesa",
    description:
      "Settlement arrives in M-Pesa or your bank. USD settles T+3 to 5 business days; local mobile money settles T+1.",
    note: "Estimated until Payaza confirms, then every line is exact.",
  },
] as const

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      className="mx-auto flex w-full max-w-[110rem] scroll-mt-8 flex-col gap-12 px-4 py-20 md:px-8 lg:px-12 2xl:px-16 md:py-28"
    >
      <SectionHeading
        id="how-heading"
        eyebrow="How It Works"
        title="From A Telegram Message To KES In M-Pesa"
        intro="Four steps between a buyer's message and money in your account, and you only touch the first one."
      />
      <div className="relative">
        {/* Connector line behind the step icons on wide screens. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-5 right-[12%] left-10 hidden h-px bg-linear-to-r from-brand-lagoon via-brand-violet to-brand-leaf opacity-60 lg:block"
        />
        <ol className="relative grid gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="relative flex flex-col gap-4 md:row-span-4 md:grid md:grid-rows-subgrid"
            >
              <div className="flex items-center">
                {/* Solid backing so the connector line only shows between steps. */}
                <span className="flex items-center gap-3 bg-background pr-3">
                  <span
                    className={`flex size-10 items-center justify-center rounded-full ${step.tone}`}
                  >
                    <step.icon className="size-5" />
                  </span>
                  <span className="font-mono text-sm text-muted-foreground">
                    Step {index + 1}
                  </span>
                </span>
              </div>
              <h3 className="font-heading text-xl font-semibold tracking-tight text-balance">
                {step.title}
              </h3>
              <p className="leading-relaxed text-pretty text-muted-foreground">
                {step.description}
              </p>
              <p className="border-t border-border pt-3 text-sm">{step.note}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

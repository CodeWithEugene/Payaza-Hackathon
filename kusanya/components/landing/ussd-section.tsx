import { MessageSquareText, Phone, Smartphone } from "lucide-react"

import { Eyebrow } from "./section-heading"

const USSD_CODE = "*384*11400#"

const POINTS = [
  {
    icon: Phone,
    title: "Dial To Invoice",
    description: "Pick a buyer, enter the amount, confirm. The invoice and its Payaza pay link go out while you are still on the call.",
  },
  {
    icon: Smartphone,
    title: "Buyers Pay From Any Phone",
    description: "Buyers dial the same code, enter the invoice number and approve an M-Pesa prompt. No app, no data bundle.",
  },
  {
    icon: MessageSquareText,
    title: "SMS Orders And Alerts",
    description: "Text an order and get the invoice back, reply SEND to send it, and get an SMS the moment Payaza confirms payment.",
  },
] as const

/** USSD + SMS on Africa's Talking: works on every phone, online or not. */
export function UssdSection() {
  return (
    <section
      id="ussd"
      aria-labelledby="ussd-heading"
      className="mx-auto grid w-full max-w-[110rem] scroll-mt-8 items-center gap-12 px-4 py-20 md:px-8 md:py-28 lg:grid-cols-[1fr_0.8fr] lg:gap-16 lg:px-12 2xl:px-16"
    >
      <div className="flex flex-col gap-6">
        <Eyebrow>USSD And SMS</Eyebrow>
        <h2
          id="ussd-heading"
          className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl"
        >
          Every Phone Can Get Paid, Even Without Internet
        </h2>
        <p className="max-w-xl text-lg text-pretty text-muted-foreground">
          Kusanya runs on USSD and SMS through Africa&apos;s Talking, so an exporter on a feature phone can invoice a buyer
          abroad and a buyer in Kisumu can pay by M-Pesa, all on Payaza rails.
        </p>
        <ul className="grid gap-5 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {POINTS.map((p) => (
            <li key={p.title} className="flex flex-col gap-2">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <p.icon className="size-5" />
              </span>
              <h3 className="font-semibold">{p.title}</h3>
              <p className="text-sm text-pretty text-muted-foreground">{p.description}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* A feature-phone style USSD screen, drawn with the app's tokens. */}
      <div className="mx-auto w-full max-w-sm">
        <div className="rounded-[2.5rem] bg-brand-ink p-4 shadow-2xl ring-1 ring-foreground/10">
          <div className="flex flex-col gap-4 rounded-[2rem] bg-[#0c2a1f] p-6 font-mono text-[#b8f5d4]">
            <p className="text-xs tracking-widest text-[#b8f5d4]/70 uppercase">Dial</p>
            <p className="text-3xl font-semibold tracking-tight text-white">{USSD_CODE}</p>
            <div className="h-px bg-[#b8f5d4]/20" />
            <div className="flex flex-col gap-1.5 text-sm leading-relaxed">
              <p className="text-white">Kusanya: FreshLeaf Exports</p>
              <p>1. Collections summary</p>
              <p>2. Latest invoices</p>
              <p>3. Create invoice</p>
              <p>4. Pay an invoice</p>
              <p>5. Help</p>
            </div>
            <div className="mt-2 flex items-center justify-between rounded-xl bg-[#b8f5d4]/10 px-4 py-2 text-xs">
              <span>Reply with 1 to 5</span>
              <span className="font-semibold text-white">Send</span>
            </div>
          </div>
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Try it on the Africa&apos;s Talking sandbox simulator.
        </p>
      </div>
    </section>
  )
}

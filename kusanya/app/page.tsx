import Link from "next/link";
import {
  Apple,
  ArrowRight,
  Banknote,
  CreditCard,
  MailCheck,
  MessageCircle,
  ScrollText,
  Send,
  ShieldCheck,
  Signal,
  Smartphone,
  SmartphoneNfc,
  Sparkles,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ModeToggle } from "@/components/mode-toggle";

const HOW_IT_WORKS = [
  {
    step: "Step 1",
    icon: MessageCircle,
    title: "Buyer messages you on WhatsApp",
    description:
      "Paste the order into Kusanya. Jev AI reads it, and deterministic code resolves every number — quantities, unit prices, totals, due dates.",
    footer: "No templates to maintain, nothing to retype.",
  },
  {
    step: "Step 2",
    icon: Send,
    title: "We screen, invoice and send",
    description:
      "Every invoice is risk-screened before it goes out. Your buyer pays by card in USD — or M-Pesa, MTN, Airtel and Tigo in KES, UGX and TZS.",
    footer: "Borderline cases wait for a human, not an auto-block.",
  },
  {
    step: "Step 3",
    icon: Wallet,
    title: "Money lands as KES in your M-Pesa or bank",
    description:
      "Settlement arrives where you bank, with a transparency waterfall showing every fee and the exact FX rate applied.",
    footer: "Estimated until Payaza confirms — then every line is exact.",
  },
];

// Static illustrative figures — these EXACTLY match the seeded demo's USD
// 1,150 French-beans order (the one judges open on the invoice detail page),
// computed by the real waterfall engine (buildWaterfall + invoiceWaterfall):
// gross 115000 −Payaza 2185 −Kusanya(1.5% of running) 1692 = 111123 USD minor;
// ×128.90 = 14323755 KES minor; −agent split(2.5%) 358094; −payout fee(1%) 139657
// → 13826004 KES minor = KES 138,260.04. Marketing must not drift from the demo.
const WATERFALL_ROWS = [
  { label: "Gross invoice", note: "card checkout", value: "USD 1,150.00" },
  { label: "Card processing fee", note: "Payaza 1.9%", value: "−USD 21.85" },
  { label: "Kusanya fee", note: "1.5%", value: "−USD 16.92" },
  { label: "FX conversion", note: "@ 128.90 KES/USD", value: "KES 143,237.55" },
  { label: "Agent split", note: "2.5%", value: "−KES 3,580.94" },
  { label: "Payout fee", note: "M-Pesa 1%", value: "−KES 1,396.57" },
];

const RAILS = [
  {
    icon: CreditCard,
    title: "Cards — USD & EUR",
    description:
      "A hosted checkout link your international buyer pays in seconds. Visa and Mastercard, settled in dollars.",
    badges: ["USD", "EUR"],
  },
  {
    icon: Apple,
    title: "Apple Pay",
    description:
      "One tap on an iPhone — the buyer's wallet handles the rest, so checkout abandonment drops.",
    badges: ["USD", "EUR"],
  },
  {
    icon: SmartphoneNfc,
    title: "Google Pay",
    description:
      "Android buyers pay straight from their wallet without digging out card details.",
    badges: ["USD", "EUR"],
  },
  {
    icon: Smartphone,
    title: "M-Pesa — Kenya",
    description:
      "STK push to your Kenyan buyers, confirmed by webhook the moment they enter their PIN.",
    badges: ["KES"],
  },
  {
    icon: Signal,
    title: "MTN & Airtel — Uganda",
    description:
      "Mobile-money collections from Ugandan buyers on both major networks.",
    badges: ["UGX"],
  },
  {
    icon: Banknote,
    title: "M-Pesa & Tigo Pesa — Tanzania",
    description:
      "Mobile-money collections from Tanzanian buyers, reconciled against the same invoice.",
    badges: ["TZS"],
  },
];

const TRUST = [
  {
    icon: ShieldCheck,
    title: "Composite risk screening",
    description:
      "Several signals are scored together — first-time buyers, sanctions lists, amount anomalies, payment history. Anything borderline lands in a human review queue with the reasons spelled out; nothing gets silently blocked.",
  },
  {
    icon: MailCheck,
    title: "AI-drafted dunning, guardrail-checked",
    description:
      "Reminders are drafted by Jev in your tone, then run through guardrails — no threats, no wrong figures, nothing sent until you approve the draft.",
  },
  {
    icon: ScrollText,
    title: "Append-only audit trail",
    description:
      "Every action — AI or human — is logged with its before-and-after state. When a buyer or a bank asks what happened, you can replay the whole story.",
  },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-primary text-xs font-medium tracking-widest uppercase">
      {children}
    </p>
  );
}

function SectionHeading({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="font-heading text-2xl font-semibold tracking-tight text-balance md:text-3xl">
        {title}
      </h2>
      {intro ? (
        <p className="text-muted-foreground max-w-2xl text-pretty md:text-base">
          {intro}
        </p>
      ) : null}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="bg-background text-foreground flex min-h-svh flex-col">
      <header className="border-border border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg font-mono text-sm font-semibold">
              k.
            </div>
            <span className="font-heading text-lg font-semibold tracking-tight">
              kusanya
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <ModeToggle />
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Start free</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 md:px-6">
        {/* Hero */}
        <section className="flex flex-col items-center gap-6 py-16 text-center md:py-24">
          <Badge variant="secondary" className="gap-1.5 px-3 py-1">
            <Sparkles />
            Built on Payaza · Borderless Kenya Hackathon
          </Badge>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance md:text-6xl">
            Get paid for your exports,{" "}
            <span className="text-primary">without the chase</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl text-pretty text-lg md:text-xl">
            A WhatsApp order becomes a clean invoice in seconds. Your buyer
            pays by USD card or African mobile money. You receive KES in your
            M-Pesa — with every fee and the FX rate shown before you hit send.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/signup">
                Start free
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/demo">See the live demo</Link>
            </Button>
          </div>
        </section>

        <Separator />

        {/* How it works */}
        <section className="flex flex-col gap-8 py-12 md:py-16">
          <SectionHeading
            eyebrow="How it works"
            title="From WhatsApp order to KES in M-Pesa"
            intro="Three steps between a buyer's message and money in your account."
          />
          <div className="grid gap-4 md:grid-cols-3">
            {HOW_IT_WORKS.map((item) => (
              <Card key={item.step}>
                <CardHeader>
                  <CardAction>
                    <Badge variant="outline" className="font-mono">
                      {item.step}
                    </Badge>
                  </CardAction>
                  <CardTitle className="flex items-center gap-2">
                    <item.icon className="text-primary size-4 shrink-0" />
                    {item.title}
                  </CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
                <CardFooter>
                  <p className="text-muted-foreground text-xs">{item.footer}</p>
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>

        <Separator />

        {/* Transparency waterfall */}
        <section className="flex flex-col items-center gap-8 py-12 md:py-16">
          <div className="flex flex-col items-center gap-2 text-center">
            <Eyebrow>Every fee, shown</Eyebrow>
            <h2 className="font-heading text-2xl font-semibold tracking-tight text-balance md:text-3xl">
              Know the exact KES before you send the invoice
            </h2>
            <p className="text-muted-foreground max-w-xl text-pretty">
              This is what a USD 1,150 order looks like on the way to your
              M-Pesa — nothing hidden, nothing discovered later.
            </p>
          </div>
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardAction>
                <Badge variant="secondary">USD → KES</Badge>
              </CardAction>
              <CardTitle>Transparency waterfall</CardTitle>
              <CardDescription>
                One invoice, every deduction, the real FX rate.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5">
              {WATERFALL_ROWS.map((row) => (
                <div
                  key={row.label}
                  className="flex items-baseline justify-between gap-4 text-sm"
                >
                  <span className="text-muted-foreground">
                    {row.label}
                    <span className="ml-1.5 text-xs">({row.note})</span>
                  </span>
                  <span className="font-mono tabular-nums">{row.value}</span>
                </div>
              ))}
              <div className="border-border flex items-baseline justify-between gap-4 border-t pt-3">
                <span className="text-sm font-medium">To your M-Pesa</span>
                <span className="font-mono text-base font-semibold tabular-nums">
                  KES 138,260.04
                </span>
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-muted-foreground text-xs">
                Illustrative figures. Yours update live as Payaza confirms each
                step.
              </p>
            </CardFooter>
          </Card>
        </section>

        <Separator />

        {/* Rails */}
        <section className="flex flex-col gap-8 py-12 md:py-16">
          <SectionHeading
            eyebrow="Rails"
            title="One invoice, every rail your buyer has"
            intro="Cards and wallets for international buyers, mobile money for the region — all on the same invoice link."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {RAILS.map((rail) => (
              <Card key={rail.title} size="sm">
                <CardHeader>
                  <CardAction>
                    <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
                      <rail.icon className="size-4" />
                    </span>
                  </CardAction>
                  <CardTitle>{rail.title}</CardTitle>
                  <CardDescription>{rail.description}</CardDescription>
                </CardHeader>
                <CardFooter className="gap-1.5">
                  {rail.badges.map((currency) => (
                    <Badge key={currency} variant="outline" className="font-mono">
                      {currency}
                    </Badge>
                  ))}
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>

        <Separator />

        {/* Trust */}
        <section className="flex flex-col gap-8 py-12 md:py-16">
          <SectionHeading
            eyebrow="Trust"
            title="AI where it helps. Checks everywhere it matters."
            intro="Collections across borders means real risk. Kusanya treats it honestly."
          />
          <div className="grid gap-4 md:grid-cols-3">
            {TRUST.map((item) => (
              <Card key={item.title} size="sm">
                <CardHeader>
                  <CardAction>
                    <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
                      <item.icon className="size-4" />
                    </span>
                  </CardAction>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-border border-t">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-4 px-4 py-8 md:flex-row md:px-6">
          <div className="flex flex-col items-center gap-1 text-center md:items-start md:text-left">
            <span className="text-sm font-medium">
              Kusanya · Team Technetians · Payaza × Hackhouse Borderless Kenya
            </span>
            <span className="text-muted-foreground text-xs">
              Invoice-first international collections for Kenyan SME exporters.
            </span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Create account
            </Link>
            <Link
              href="/demo"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Live demo
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

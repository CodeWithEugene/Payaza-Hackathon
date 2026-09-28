import { CircleCheck, Send, ShieldCheck, Wallet } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

import { AGENT_SPLIT, DEMO_BUYER_MESSAGE, NET_PAYOUT } from "./data"

const MOCK_SHADOW =
  "shadow-[0_24px_60px_-20px_rgb(15_18_49/0.35)] dark:shadow-[0_24px_60px_-20px_rgb(0_0_0/0.8)]"

/**
 * The floating product mock in the hero: the seeded demo's Telegram order,
 * the invoice it became, and the M-Pesa payout it ended as. Decorative
 * duplicate of real UI, so it is exposed to assistive tech as one labelled
 * figure with a text summary instead of three competing card trees.
 */
export function ProductMock() {
  return (
    <figure
      aria-label="Example: a Telegram order from Dubai Fresh FZE becomes invoice KSN-2026-0001 for USD 1,150, paid by card, with KES 138,260.04 paid out to M-Pesa."
      className="relative mx-auto flex w-full max-w-md flex-col lg:max-w-lg"
    >
      <div aria-hidden="true" className="contents">
        <div className="k-float-slow z-10 w-[90%] self-start sm:w-[78%]">
          <TelegramCard />
        </div>
        <div className="k-float z-20 -mt-3 w-[96%] self-end sm:w-[86%]">
          <InvoiceCard />
        </div>
        <div className="k-float-slow z-30 -mt-1 w-[84%] self-start sm:w-[66%]">
          <PayoutCard />
        </div>
      </div>
    </figure>
  )
}

function TelegramCard() {
  return (
    <Card size="sm" className={`-rotate-2 ${MOCK_SHADOW}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-brand-lagoon/15 text-brand-lagoon">
            <Send className="size-3.5" />
          </span>
          Susan Kamau
        </CardTitle>
        <CardDescription>Dubai Fresh FZE via Telegram</CardDescription>
        <CardAction>
          <span className="font-mono text-xs text-muted-foreground">09:14</span>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2.5 text-[0.8rem] leading-relaxed">
          {DEMO_BUYER_MESSAGE}
        </p>
      </CardContent>
    </Card>
  )
}

function InvoiceCard() {
  return (
    <Card className={MOCK_SHADOW}>
      <CardHeader>
        <CardDescription className="font-mono text-xs">
          KSN-2026-0001
        </CardDescription>
        <CardTitle className="text-lg font-semibold">Dubai Fresh FZE</CardTitle>
        <CardAction>
          <Badge className="gap-1 bg-brand-leaf/15 text-brand-leaf">
            <CircleCheck />
            Paid
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 text-muted-foreground">
            French beans (kg)
            <span className="ml-1.5 font-mono text-xs whitespace-nowrap">
              500 × 2.30
            </span>
          </span>
          <span className="shrink-0 font-mono whitespace-nowrap tabular-nums">
            USD 1,150.00
          </span>
        </div>
        <Separator />
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-medium">Total due</span>
          <span className="font-mono text-xl font-semibold tabular-nums">
            USD 1,150.00
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["Visa", "Mastercard", "Apple Pay", "Google Pay"].map((method) => (
            <Badge key={method} variant="outline">
              {method}
            </Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter className="justify-between gap-3 border-t bg-muted/50 py-3">
        <span className="flex items-center gap-1.5 text-xs">
          <ShieldCheck className="size-3.5 text-brand-leaf" />
          Risk screen passed
        </span>
        <span className="text-xs text-muted-foreground">
          Payment link by Payaza
        </span>
      </CardFooter>
    </Card>
  )
}

function PayoutCard() {
  return (
    <Card size="sm" className={`rotate-1 ${MOCK_SHADOW}`}>
      <CardContent className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-leaf/15 text-brand-leaf">
          <Wallet className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-xs text-muted-foreground">
            Paid out to M-Pesa
          </span>
          <span className="font-mono text-lg font-semibold tabular-nums">
            {NET_PAYOUT}
          </span>
          <span className="text-xs text-muted-foreground">
            Agent split {AGENT_SPLIT} · FX 128.90
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

import type { Metadata } from "next";
import Link from "next/link";

import { DemoLauncher } from "@/components/demo/demo-launcher";
import { KusanyaMark } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Live Demo",
};

export default function DemoPage() {
  return (
    <div className="bg-background min-h-svh">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 md:px-6 md:py-16">
        <header className="flex flex-col gap-4">
          <Link href="/" className="flex w-fit items-center gap-2">
            <KusanyaMark className="size-8" />
            <span className="font-heading text-lg font-semibold tracking-tight">
              kusanya
            </span>
          </Link>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            Judges, Start Here
          </h1>
          <p className="text-muted-foreground text-pretty md:text-lg">
            Kusanya turns a Telegram order into a screened, sent and settled
            invoice for Kenyan exporters. USD cards and East African mobile
            money in, KES out to M-Pesa, with every fee and the FX rate shown
            before anything is sent. Try it live: message{" "}
            <a className="text-primary underline underline-offset-4" href="https://t.me/kusanya_invoice_bot" target="_blank" rel="noopener noreferrer">
              @kusanya_invoice_bot
            </a>{" "}
            after connecting it in Settings. One button below loads the full story of
            FreshLeaf Exports Ltd, a Nairobi produce exporter, with invoices
            caught at every moment of the journey: mid-payment, underpaid,
            held by screening, and fully settled.
          </p>
        </header>
        <DemoLauncher />
      </div>
    </div>
  );
}

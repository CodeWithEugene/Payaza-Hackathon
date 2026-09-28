import type { Metadata } from "next";

import { requireBusiness } from "@/lib/auth/guards";
import { loadBuyerCandidates } from "@/lib/services/extraction";
import { InvoiceWizard } from "@/components/wizard/invoice-wizard";

export const metadata: Metadata = { title: "New Invoice" };

/** New invoice — the AI wizard (paste → extract → review → screened send). */
export default async function NewInvoicePage() {
  const { business } = await requireBusiness();
  const candidates = await loadBuyerCandidates(business.id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          New Invoice
        </h1>
        <p className="text-sm text-muted-foreground">
          Paste the buyer&apos;s message. Kusanya reads it, and you confirm it.
        </p>
      </header>
      <InvoiceWizard candidates={candidates} />
    </div>
  );
}

"use client";

import { useState } from "react";
import { PenLine, Sparkles } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PasteStep,
  type BuyerCandidate,
  type ExtractApiResponse,
} from "@/components/wizard/paste-step";
import { ReviewStep } from "@/components/wizard/review-step";

/**
 * InvoiceWizard — the demo centerpiece. Two paths to the same screened
 * invoice: the AI flow (paste → Jev extraction → review) and a manual flow
 * (same review form, plain fields, no confidence treatment).
 */

export function InvoiceWizard({
  candidates,
}: {
  candidates: BuyerCandidate[];
}) {
  const [tab, setTab] = useState<"ai" | "manual">("ai");
  const [step, setStep] = useState<"paste" | "review">("paste");
  const [extraction, setExtraction] = useState<ExtractApiResponse | null>(null);

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v === "manual" ? "manual" : "ai")}
    >
      <TabsList>
        <TabsTrigger value="ai">
          <Sparkles data-icon="inline-start" />
          AI Wizard
        </TabsTrigger>
        <TabsTrigger value="manual">
          <PenLine data-icon="inline-start" />
          Manual
        </TabsTrigger>
      </TabsList>

      <TabsContent value="ai" className="pt-2">
        {step === "review" && extraction ? (
          <ReviewStep
            key={extraction.extractionId}
            extraction={extraction}
            candidates={extraction.result.buyerCandidates ?? candidates}
            onBack={() => {
              // Keep it simple: Back resets the paste step.
              setExtraction(null);
              setStep("paste");
            }}
          />
        ) : (
          <PasteStep
            onExtracted={(data) => {
              setExtraction(data);
              setStep("review");
            }}
          />
        )}
      </TabsContent>

      <TabsContent value="manual" className="pt-2">
        <ReviewStep
          key="manual"
          extraction={null}
          candidates={candidates}
          onBack={() => setTab("ai")}
        />
      </TabsContent>
    </Tabs>
  );
}

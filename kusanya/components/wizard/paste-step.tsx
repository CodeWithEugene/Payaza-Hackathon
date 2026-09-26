"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

/**
 * Paste step — the merchant drops the buyer's WhatsApp/email text in and Jev
 * AI reads it. DTO types are declared locally (client-safe mirror of
 * POST /api/invoices/extract — the server types live in lib/jev/types.ts).
 */

export interface ExtractedFieldDto<T> {
  value: T | null;
  /** 0..1 per-field confidence. */
  confidence: number;
  /** Verbatim snippet from the source text backing this field. */
  snippet: string | null;
  /** True when resolved in code (numbers/dates), never typed by the model. */
  deterministic: boolean;
  /** True when produced by the demo-rules fallback (honesty labeling). */
  demo?: boolean;
}

export interface BuyerCandidate {
  id: string;
  name: string;
  country: string;
  email: string | null;
  phone: string | null;
}

export interface ExtractedItemDto {
  description: string;
  qty: number;
  unitPriceMinor: number | null;
  currency: string | null;
  confidence: number;
}

export interface ExtractApiResponse {
  extractionId: string;
  result: {
    buyer: ExtractedFieldDto<string>;
    buyerCandidateId: string | null;
    buyerCandidates: BuyerCandidate[];
    items: ExtractedItemDto[];
    total: ExtractedFieldDto<number>; // MINOR units
    currency: ExtractedFieldDto<string>; // USD|KES|UGX|TZS
    dueDate: ExtractedFieldDto<string>; // ISO date "YYYY-MM-DD"
    firmOrder: ExtractedFieldDto<boolean>;
    quality: number; // 0..1
    model: string; // "jev-latest" | "demo-rules-v1"
    durationMs: number;
  };
}

const SAMPLE_MESSAGE =
  "Hi Wanjiru, please send 500kg French beans at USD 2.30/kg, total 1,150. Payment by card in 5 days.";

export function PasteStep({
  onExtracted,
}: {
  onExtracted: (payload: ExtractApiResponse) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [enquiryWarning, setEnquiryWarning] = useState(false);

  async function extract() {
    const trimmed = text.trim();
    if (trimmed.length < 3) {
      toast.error("Paste the buyer's message first (at least a few words).");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/invoices/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, sourceType: "paste" }),
      });
      const data = (await res.json().catch(() => null)) as
        | (ExtractApiResponse & { error?: string })
        | null;
      if (!res.ok || !data || !data.result) {
        toast.error(data?.error ?? "Extraction failed — please try again.");
        return;
      }
      setEnquiryWarning(data.result.firmOrder.value === false);
      onExtracted(data);
    } catch {
      toast.error("Could not reach Jev AI. Check your connection and retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paste the buyer&apos;s message</CardTitle>
        <CardDescription>
          A WhatsApp thread, an email or an order note — any language. Kusanya
          extracts the fields; every amount and date is resolved in code.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="paste-message">Buyer&apos;s message</FieldLabel>
            <Textarea
              id="paste-message"
              rows={10}
              placeholder="Paste the buyer's WhatsApp message, email or order note… (e.g. 'Hi Wanjiru, please send 500kg French beans at USD 2.30/kg, total 1,150. Payment by card in 5 days.')"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={busy}
            />
            <FieldDescription>
              The raw text is kept with the invoice as your audit trail.
            </FieldDescription>
          </Field>

          {enquiryWarning && (
            <Alert>
              <TriangleAlert />
              <AlertTitle>Enquiry, not a firm order?</AlertTitle>
              <AlertDescription>
                This reads like an enquiry, not a firm order — you can still
                invoice, but confirm with the buyer.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setText(SAMPLE_MESSAGE)}
              disabled={busy}
            >
              Fill sample message
            </Button>
            <Button type="button" onClick={extract} disabled={busy}>
              {busy ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Sparkles data-icon="inline-start" />
              )}
              Extract with Jev AI
            </Button>
          </div>

          {busy && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
              Reading your message… numbers are resolved in code, never invented
              by the model.
            </p>
          )}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

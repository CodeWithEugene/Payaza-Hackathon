"use client";

import type { ReactNode } from "react";
import { BadgeCheck, Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * ConfidenceField — the signature Kusanya control. Wraps any form control with
 * the honest-AI treatment from docs/ui-contract.md:
 *
 *   HIGH ≥ 0.85 → quiet, prefilled (plain Field)
 *   MED  ≥ 0.60 → subtle muted wrapper + snippet tooltip on the % badge
 *   LOW  < 0.60 → secondary wrapper + visible source snippet + the merchant
 *                 MUST tap "Confirm" before the form can submit
 *
 * `deterministic` fields (amounts/dates resolved in code, never typed by the
 * model) get a "code-verified" badge; demo-rules output is labeled as such.
 * `confidence: null` = manual field → plain Field, no band treatment.
 *
 * Semantic tokens only (opacity variants like bg-muted/40 are allowed).
 */

export const HIGH_CONFIDENCE = 0.85;
export const MED_CONFIDENCE = 0.6;

export type ConfidenceBand = "high" | "medium" | "low";

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= HIGH_CONFIDENCE) return "high";
  if (confidence >= MED_CONFIDENCE) return "medium";
  return "low";
}

export interface ConfidenceFieldProps {
  label: string;
  /** 0..1 from the extraction, or null for a manual (non-AI) field. */
  confidence: number | null;
  /** Verbatim snippet from the buyer's message backing this field. */
  snippet?: string | null;
  /** True when the value was resolved in code (numbers/dates). */
  deterministic?: boolean;
  /** True when produced by the demo-rules fallback — honesty labeling. */
  demo?: boolean;
  /** Whether the merchant has tapped "Confirm" (only gates LOW fields). */
  confirmed: boolean;
  onConfirm: () => void;
  required?: boolean;
  /** The actual control (Input, Select, ToggleGroup…). */
  children: ReactNode;
}

export function ConfidenceField({
  label,
  confidence,
  snippet,
  deterministic,
  demo,
  confirmed,
  onConfirm,
  required,
  children,
}: ConfidenceFieldProps) {
  // Manual field — no extraction, no band treatment.
  if (confidence === null) {
    return (
      <Field>
        <FieldLabel>
          {label}
          {required && (
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          )}
        </FieldLabel>
        {children}
      </Field>
    );
  }

  const band = confidenceBand(confidence);
  const pctBadge = (
    <Badge
      variant={band === "high" ? "secondary" : "outline"}
      className="font-mono tabular-nums"
    >
      {Math.round(confidence * 100)}%
    </Badge>
  );

  return (
    <Field>
      <div className="flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <FieldLabel>
          {label}
          {required && (
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          )}
        </FieldLabel>
        <div className="flex flex-wrap items-center gap-1.5">
          {band === "low" &&
            (confirmed ? (
              <Badge variant="secondary">
                <Check data-icon="inline-start" />
                Confirmed
              </Badge>
            ) : (
              <Badge variant="secondary">Needs your confirmation</Badge>
            ))}
          {band === "medium" ? (
            <Tooltip>
              <TooltipTrigger asChild>{pctBadge}</TooltipTrigger>
              <TooltipContent>
                {snippet ? (
                  <>
                    From the message: <span className="italic">“{snippet}”</span>
                  </>
                ) : (
                  "Medium confidence — worth a quick check."
                )}
              </TooltipContent>
            </Tooltip>
          ) : (
            pctBadge
          )}
          {deterministic && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline">
                  <BadgeCheck data-icon="inline-start" />
                  code-verified
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Numbers and dates are resolved in code from your text — the AI
                never types them
              </TooltipContent>
            </Tooltip>
          )}
          {demo && <Badge variant="outline">Demo rules</Badge>}
        </div>
      </div>

      {band === "high" && children}

      {band === "medium" && (
        <div className="rounded-lg border border-border/60 bg-muted/40 p-2">
          {children}
        </div>
      )}

      {band === "low" && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary p-2">
          {children}
          {snippet && (
            <p className="text-xs text-muted-foreground">
              From the message: <span className="italic">“{snippet}”</span>
            </p>
          )}
          {!confirmed && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={onConfirm}
            >
              <Check data-icon="inline-start" />
              Confirm
            </Button>
          )}
        </div>
      )}
    </Field>
  );
}

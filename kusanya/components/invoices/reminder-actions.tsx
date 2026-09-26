"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface GuardrailClaim {
  claim?: string;
  supported?: boolean;
  probability?: number;
}

interface GuardrailShape {
  blocked?: boolean;
  reason?: string;
  claims?: GuardrailClaim[];
}

/** Human reason out of a guardrail snapshot — defensive, jsonb is schemaless. */
function guardrailReason(guardrail: unknown): string | null {
  if (!guardrail || typeof guardrail !== "object") return null;
  const g = guardrail as GuardrailShape;
  const claims = Array.isArray(g.claims) ? g.claims : [];
  const bad = claims.filter((c) => c && typeof c === "object" && c.supported === false);
  if (bad.length > 0) {
    const first = typeof bad[0]?.claim === "string" ? bad[0].claim : null;
    return first ? `unsupported claim: “${first}”` : `${bad.length} unsupported claim(s)`;
  }
  if (typeof g.reason === "string" && g.reason.trim()) return g.reason;
  return null;
}

/**
 * Reminder actions island — AI drafts, guardrail checks, human sends.
 * "Draft & check" POSTs the draft route (guardrail re-check);
 * "Approve & send" POSTs the approve route (send).
 */
export function ReminderActions({
  invoiceId,
  reminderId,
  status,
}: {
  invoiceId: string;
  reminderId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"draft" | "approve" | null>(null);

  if (status !== "scheduled" && status !== "draft") return null;

  const base = `/api/invoices/${invoiceId}/reminders/${reminderId}`;

  async function draftAndCheck() {
    if (busy) return;
    setBusy("draft");
    try {
      const res = await fetch(`${base}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; guardrail?: GuardrailShape }
        | null;
      if (!res.ok || !data || typeof data.error === "string") {
        toast.error(data?.error ?? "Could not draft the reminder.");
        return;
      }
      router.refresh();
      if (data.guardrail?.blocked === true) {
        const reason = guardrailReason(data.guardrail) ?? "unsupported or unsafe claims";
        toast.error(`Blocked by guardrail: ${reason}`);
      } else {
        toast.success("Draft checked against your ledger — review it, then send.");
      }
    } catch {
      toast.error("Could not draft the reminder. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function approveAndSend() {
    if (busy) return;
    setBusy("approve");
    try {
      const res = await fetch(`${base}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; skipped?: boolean; reason?: string }
        | null;
      if (!res.ok || !data || typeof data.error === "string") {
        toast.error(data?.error ?? "Could not send the reminder.");
        return;
      }
      router.refresh();
      if (data.skipped) {
        toast(`Reminder skipped — ${data.reason ?? "invoice no longer open"}.`);
      } else {
        toast.success("Reminder sent to the buyer.");
      }
    } catch {
      toast.error("Could not send the reminder. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={draftAndCheck}
        disabled={busy !== null}
      >
        {busy === "draft" ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <ScanSearch data-icon="inline-start" />
        )}
        Draft &amp; check
      </Button>
      {status === "draft" && (
        <Button size="sm" onClick={approveAndSend} disabled={busy !== null}>
          {busy === "approve" ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Check data-icon="inline-start" />
          )}
          Approve &amp; send
        </Button>
      )}
    </div>
  );
}

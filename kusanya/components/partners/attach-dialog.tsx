"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2, Split } from "lucide-react";

import { attachSplitsAction } from "@/lib/actions/rails-partners";
import { StatusBadge, statusLabel } from "@/components/invoices/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";

export interface AttachPartner {
  id: string;
  name: string;
  sharePct: number;
}

export interface AttachInvoice {
  id: string;
  number: string;
  status: string;
  buyerName: string;
}

interface PartnerRow {
  enabled: boolean;
  sharePct: string;
}

/**
 * Attach split allocations to one invoice. Splits ride along in the buyer's
 * Payaza checkout — nothing extra for the buyer to do.
 */
export function AttachSplitsDialog({
  partners,
  invoices,
}: {
  partners: AttachPartner[];
  invoices: AttachInvoice[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [invoiceId, setInvoiceId] = React.useState("");
  const [rows, setRows] = React.useState<Record<string, PartnerRow>>({});

  function resetRows() {
    const next: Record<string, PartnerRow> = {};
    for (const p of partners) {
      next[p.id] = { enabled: false, sharePct: String(p.sharePct) };
    }
    setRows(next);
  }

  const selected = invoices.find((i) => i.id === invoiceId) ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invoiceId || !selected) {
      toast.error("Pick the invoice to attach splits to.");
      return;
    }
    const allocations: { partnerId: string; sharePct: number }[] = [];
    for (const p of partners) {
      const row = rows[p.id];
      if (!row?.enabled) continue;
      const pct = Number(row.sharePct);
      if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) {
        toast.error(`${p.name}: enter a share between 0 and 100 percent.`);
        return;
      }
      allocations.push({ partnerId: p.id, sharePct: pct });
    }
    if (allocations.length === 0) {
      toast.error("Switch on at least one partner, or close the dialog to leave the invoice without splits.");
      return;
    }
    const total = allocations.reduce((s, a) => s + a.sharePct, 0);
    if (total > 100) {
      toast.error(`Split shares sum to ${total}%, but they must be ≤ 100%.`);
      return;
    }
    setBusy(true);
    const res = await attachSplitsAction(invoiceId, allocations);
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      toast.success(
        `Splits attached to ${selected.number}. ${allocations.length} partner${allocations.length === 1 ? "" : "s"} will be paid automatically when it's collected.`,
      );
      router.refresh();
    } else {
      toast.error(res.error ?? "Could not attach splits.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setInvoiceId("");
          resetRows();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" disabled={partners.length === 0}>
          <Split data-icon="inline-start" />
          Attach Splits To An Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Attach Splits To An Invoice</DialogTitle>
          <DialogDescription>
            Switch on the partners this invoice should pay, and adjust their share for it.
            Existing allocations on the invoice are replaced.
          </DialogDescription>
        </DialogHeader>
        {invoices.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Link2 />
              </EmptyMedia>
              <EmptyTitle>No Attachable Invoices</EmptyTitle>
              <EmptyDescription>
                Splits attach to invoices that are ready, sent, partially paid or paid, before
                payment starts moving.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="attach-invoice">Invoice</FieldLabel>
                <Select value={invoiceId} onValueChange={setInvoiceId}>
                  <SelectTrigger id="attach-invoice" className="w-full">
                    <SelectValue placeholder="Pick an invoice" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {invoices.map((inv) => (
                        <SelectItem key={inv.id} value={inv.id}>
                          <span className="font-mono">{inv.number}</span>
                          <span className="text-muted-foreground">·</span>
                          <span>{inv.buyerName}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">{statusLabel(inv.status)}</span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {selected ? (
                  <FieldDescription>
                    Current status: <StatusBadge status={selected.status} />
                  </FieldDescription>
                ) : null}
              </Field>

              <Field>
                <FieldLabel>Partners on this invoice</FieldLabel>
                <FieldDescription>
                  Shares are percentages of the invoice gross. Payaza pays them from the
                  collection itself.
                </FieldDescription>
                <div className="flex flex-col gap-2">
                  {partners.map((p) => {
                    const row = rows[p.id] ?? { enabled: false, sharePct: String(p.sharePct) };
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                      >
                        <Switch
                          id={`attach-${p.id}`}
                          checked={row.enabled}
                          onCheckedChange={(checked) =>
                            setRows((r) => ({
                              ...r,
                              [p.id]: { ...row, enabled: checked === true },
                            }))
                          }
                          aria-label={`Include ${p.name}`}
                        />
                        <label
                          htmlFor={`attach-${p.id}`}
                          className="min-w-0 flex-1 cursor-pointer truncate text-sm font-medium"
                        >
                          {p.name}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            default {p.sharePct}%
                          </span>
                        </label>
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0.5}
                            max={99.5}
                            step={0.5}
                            className="w-20 text-right font-mono tabular-nums"
                            value={row.sharePct}
                            disabled={!row.enabled}
                            onChange={(e) =>
                              setRows((r) => ({
                                ...r,
                                [p.id]: { ...row, sharePct: e.target.value },
                              }))
                            }
                            aria-label={`${p.name} share percent`}
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Field>
            </FieldGroup>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? <Spinner data-icon="inline-start" /> : <Link2 data-icon="inline-start" />}
                Attach Splits
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

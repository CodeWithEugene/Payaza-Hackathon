"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  PenLine,
  Plus,
  Send,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ConfidenceField, confidenceBand } from "@/components/wizard/confidence-field";
import type { BuyerCandidate, ExtractApiResponse } from "@/components/wizard/paste-step";
import { createInvoiceAction } from "@/lib/actions/invoices";
import type { CreateInvoiceInput } from "@/lib/validators/invoice";
import {
  CURRENCY_CODES,
  decimals,
  isCurrency,
  minorFactor,
  type CurrencyCode,
} from "@/lib/money/currencies";
import { parseAmountToMinor } from "@/lib/money/format";

/**
 * Review step — the merchant confirms what Jev read (or types everything by
 * hand when `extraction` is null). Extracted fields render inside
 * ConfidenceField; LOW-confidence fields must be explicitly confirmed before
 * submit. Amounts are edited in MAJOR units and converted to integer minor
 * units only at the boundary (createInvoiceAction input).
 */

export interface ReviewManualDefaults {
  buyerName?: string;
  currency?: CurrencyCode;
  dueDate?: string; // "YYYY-MM-DD"
  notes?: string;
  feeBearer?: "business" | "customer";
  sendNow?: boolean;
}

interface ItemRow {
  id: string;
  description: string;
  qty: string; // major-ish plain number text
  unitPrice: string; // MAJOR units text
  confidence: number | null; // null = manually added row
}

export interface ReviewStepProps {
  /** null = manual mode (plain Fields, no confidence treatment). */
  extraction: ExtractApiResponse | null;
  candidates: BuyerCandidate[];
  onBack: () => void;
  manualDefaults?: ReviewManualDefaults;
}

let rowCounter = 0;
function nextRowId(): string {
  rowCounter += 1;
  return `row-${rowCounter}`;
}

/** Integer minor units → plain major-unit text for type="number" inputs. */
function toMajorText(minor: number, currency: CurrencyCode): string {
  const d = decimals(currency);
  if (d === 0) return String(Math.round(minor));
  return (minor / minorFactor(currency)).toFixed(d);
}

/**
 * parseAmountToMinor throws on unsafe magnitudes (> 2^53 minor units) — never
 * let a typed number crash the render pass or the submit handler.
 */
function safeMinor(currency: CurrencyCode, text: string): number | null {
  try {
    return parseAmountToMinor(currency, text);
  } catch {
    return null;
  }
}

export function ReviewStep({
  extraction,
  candidates,
  onBack,
  manualDefaults,
}: ReviewStepProps) {
  const router = useRouter();
  const result = extraction?.result ?? null;

  const initialCurrency: CurrencyCode =
    result?.currency.value && isCurrency(result.currency.value)
      ? result.currency.value
      : (manualDefaults?.currency ?? "USD");

  // ---------------------------------------------------------------- state --
  const [buyerMode, setBuyerMode] = useState<"existing" | "new">(() =>
    result?.buyerCandidateId ? "existing" : "new",
  );
  const [buyerId, setBuyerId] = useState<string>(
    () => result?.buyerCandidateId ?? candidates[0]?.id ?? "",
  );
  const [newName, setNewName] = useState(
    () => result?.buyer.value ?? manualDefaults?.buyerName ?? "",
  );
  const [newKind, setNewKind] = useState<"person" | "company">("person");
  const [newCountry, setNewCountry] = useState("KE");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const [items, setItems] = useState<ItemRow[]>(() => {
    if (result?.items.length) {
      return result.items.map((it) => ({
        id: nextRowId(),
        description: it.description,
        qty: String(it.qty),
        unitPrice:
          it.unitPriceMinor != null
            ? toMajorText(it.unitPriceMinor, initialCurrency)
            : "",
        confidence: typeof it.confidence === "number" ? it.confidence : null,
      }));
    }
    return [{ id: nextRowId(), description: "", qty: "1", unitPrice: "", confidence: null }];
  });

  const [currency, setCurrency] = useState<CurrencyCode>(initialCurrency);
  const [totalText, setTotalText] = useState(() =>
    result?.total.value != null && result.total.value > 0
      ? toMajorText(result.total.value, initialCurrency)
      : "",
  );
  const [totalTouched, setTotalTouched] = useState(false);
  const [dueDate, setDueDate] = useState(
    () => result?.dueDate.value ?? manualDefaults?.dueDate ?? "",
  );
  const [notes, setNotes] = useState(manualDefaults?.notes ?? "");
  const [feeBearer, setFeeBearer] = useState<"business" | "customer">(
    manualDefaults?.feeBearer ?? "business",
  );
  const [sendNow, setSendNow] = useState(manualDefaults?.sendNow ?? true);
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  function confirm(key: string) {
    setConfirmed((c) => ({ ...c, [key]: true }));
  }

  // ------------------------------------------------------- derived total --
  /** Live sum (integer minor) when every row carries a qty AND a unit price. */
  const derivedTotalMinor = useMemo<number | null>(() => {
    if (items.length === 0) return null;
    let sum = 0;
    for (const row of items) {
      const qty = Number(row.qty);
      if (!Number.isFinite(qty) || qty <= 0) return null;
      if (row.unitPrice.trim() === "") return null;
      const priceMinor = safeMinor(currency, row.unitPrice.trim());
      if (priceMinor == null) return null;
      sum += Math.round(qty * priceMinor);
    }
    return sum;
  }, [items, currency]);

  // The computed total follows the items until the merchant overrides it;
  // editing the total never writes back into the rows.
  const totalDisplay =
    !totalTouched && derivedTotalMinor != null
      ? toMajorText(derivedTotalMinor, currency)
      : totalText;

  // ------------------------------------------------- confirmation gating --
  const lowUnconfirmedCount = useMemo(() => {
    const checks: { key: string; confidence: number | null }[] = [];
    if (result) {
      checks.push({ key: "buyer", confidence: result.buyer.confidence });
      checks.push({ key: "currency", confidence: result.currency.confidence });
      checks.push({ key: "total", confidence: result.total.confidence });
      checks.push({ key: "dueDate", confidence: result.dueDate.confidence });
    }
    for (const row of items) {
      checks.push({ key: `item:${row.id}`, confidence: row.confidence });
    }
    return checks.filter(
      (c) =>
        c.confidence != null &&
        confidenceBand(c.confidence) === "low" &&
        !confirmed[c.key],
    ).length;
  }, [result, items, confirmed]);

  // ------------------------------------------------------------ row ops --
  function updateRow(id: string, patch: Partial<ItemRow>) {
    setItems((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeRow(id: string) {
    setItems((rows) => rows.filter((r) => r.id !== id));
  }
  function addRow() {
    setItems((rows) => [
      ...rows,
      { id: nextRowId(), description: "", qty: "1", unitPrice: "", confidence: null },
    ]);
  }

  // --------------------------------------------------------------- submit --
  async function submit() {
    if (lowUnconfirmedCount > 0) {
      toast.error("Confirm the highlighted fields first");
      return;
    }

    let buyer: CreateInvoiceInput["buyer"];
    if (buyerMode === "existing") {
      if (!buyerId) {
        toast.error("Choose a buyer, or switch to “New buyer”.");
        return;
      }
      buyer = { existingId: buyerId };
    } else {
      const name = newName.trim();
      const country = newCountry.trim().toUpperCase();
      const email = newEmail.trim();
      if (name.length < 2) {
        toast.error("Add the buyer's name (at least 2 characters).");
        return;
      }
      if (country.length !== 2) {
        toast.error("Use a 2-letter country code, e.g. KE or US.");
        return;
      }
      if (email && !/^\S+@\S+\.\S+$/.test(email)) {
        toast.error("Check the buyer's email address.");
        return;
      }
      buyer = {
        name,
        kind: newKind,
        country,
        email,
        phone: newPhone.trim(),
      };
    }

    if (items.length === 0) {
      toast.error("Add at least one line item.");
      return;
    }
    const payloadItems: {
      description: string;
      qty: number;
      unitPriceMinor: number | null;
    }[] = [];
    for (const row of items) {
      const description = row.description.trim();
      if (!description) {
        toast.error("Every line item needs a description.");
        return;
      }
      const qty = Number(row.qty);
      if (!Number.isFinite(qty) || qty <= 0) {
        toast.error(`“${description}”: enter a quantity above zero.`);
        return;
      }
      if (qty > 1_000_000) {
        toast.error(`“${description}”: quantity must be 1,000,000 or less.`);
        return;
      }
      let unitPriceMinor: number | null = null;
      if (row.unitPrice.trim() !== "") {
        unitPriceMinor = safeMinor(currency, row.unitPrice.trim());
        if (unitPriceMinor == null) {
          toast.error(`“${description}”: enter the unit price like 2.30 or 230.`);
          return;
        }
      }
      payloadItems.push({ description, qty, unitPriceMinor });
    }

    const totalMinor = safeMinor(currency, totalDisplay.trim());
    if (totalMinor == null || totalMinor <= 0) {
      toast.error("Enter a valid invoice total above zero.");
      return;
    }

    let dueAt: string | null = null;
    if (dueDate) {
      const d = new Date(`${dueDate}T09:00:00Z`);
      if (Number.isNaN(d.getTime())) {
        toast.error("Check the due date.");
        return;
      }
      dueAt = d.toISOString();
    }

    const input: CreateInvoiceInput = {
      buyer,
      items: payloadItems,
      totalMinor,
      currency,
      dueAt,
      notes: notes.trim() ? notes.trim() : null,
      feeBearer,
      extractionId: extraction?.extractionId ?? null,
      sendNow,
    };

    setBusy(true);
    try {
      const res = await createInvoiceAction(input);
      if (!res.ok || !res.data) {
        toast.error(res.error ?? "Could not create the invoice.");
        return;
      }
      const { invoiceId, riskDecision } = res.data;
      if (riskDecision !== "pass") {
        toast.error(
          `Risk screen: ${riskDecision}. Invoice held for review — nothing was sent.`,
        );
      } else {
        toast.success(
          sendNow
            ? "Invoice created, screened and sent 🎉"
            : "Invoice created — ready to send",
        );
      }
      router.push(`/app/invoices/${invoiceId}`);
      router.refresh();
    } catch {
      toast.error("Could not create the invoice. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const priceStep = decimals(currency) === 0 ? "1" : "0.01";

  // --------------------------------------------------------------- view --
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {extraction ? "Review what Kusanya read" : "Create an invoice"}
        </CardTitle>
        <CardDescription>
          {extraction
            ? "Edit anything freely — highlighted fields need your eye, low-confidence fields need your explicit confirmation."
            : "Fill in the details by hand — same risk screening and payment link as the AI flow."}
        </CardDescription>
        {extraction && result && (
          <CardAction>
            <div className="flex items-center gap-2">
              {result.model === "demo-rules-v1" ? (
                <Badge variant="outline">Demo rules engine</Badge>
              ) : (
                <Badge variant="secondary">
                  <Sparkles data-icon="inline-start" />
                  Jev AI
                </Badge>
              )}
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {Math.round(result.quality * 100)}% quality · {result.durationMs}
                ms
              </span>
            </div>
          </CardAction>
        )}
      </CardHeader>

      <CardContent>
        <FieldGroup>
          {result?.firmOrder.value === false && (
            <Alert>
              <TriangleAlert />
              <AlertTitle>Enquiry, not a firm order?</AlertTitle>
              <AlertDescription>
                This reads like an enquiry, not a firm order — you can still
                invoice, but confirm with the buyer.
              </AlertDescription>
            </Alert>
          )}

          {/* ------------------------------------------------------- buyer -- */}
          <ConfidenceField
            label="Buyer"
            required
            confidence={result ? result.buyer.confidence : null}
            snippet={result?.buyer.snippet}
            deterministic={result?.buyer.deterministic}
            demo={result?.buyer.demo}
            confirmed={Boolean(confirmed["buyer"])}
            onConfirm={() => confirm("buyer")}
          >
            <FieldGroup className="gap-3">
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                className="w-fit"
                value={buyerMode}
                onValueChange={(v) => {
                  if (v === "existing" || v === "new") setBuyerMode(v);
                }}
              >
                <ToggleGroupItem value="existing">Existing buyer</ToggleGroupItem>
                <ToggleGroupItem value="new">New buyer</ToggleGroupItem>
              </ToggleGroup>

              {buyerMode === "existing" ? (
                candidates.length === 0 ? (
                  <Field>
                    <FieldDescription>
                      No saved buyers yet — switch to “New buyer” and we&apos;ll
                      create the record for you.
                    </FieldDescription>
                  </Field>
                ) : (
                  <Field>
                    <FieldLabel>Choose from your directory</FieldLabel>
                    <Select value={buyerId} onValueChange={setBuyerId}>
                      <SelectTrigger className="w-full sm:max-w-xs">
                        <SelectValue placeholder="Select a buyer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Your buyers</SelectLabel>
                          {candidates.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                              {c.country ? ` · ${c.country}` : ""}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                )
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="buyer-name">Name</FieldLabel>
                    <Input
                      id="buyer-name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. GreenValley Foods Ltd"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Buyer type</FieldLabel>
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      size="sm"
                      className="w-fit"
                      value={newKind}
                      onValueChange={(v) => {
                        if (v === "person" || v === "company") setNewKind(v);
                      }}
                    >
                      <ToggleGroupItem value="company">Company</ToggleGroupItem>
                      <ToggleGroupItem value="person">Person</ToggleGroupItem>
                    </ToggleGroup>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="buyer-country">Country code</FieldLabel>
                    <Input
                      id="buyer-country"
                      value={newCountry}
                      onChange={(e) => setNewCountry(e.target.value.toUpperCase())}
                      maxLength={2}
                      placeholder="KE"
                      className="w-fit font-mono uppercase"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="buyer-email">
                      Email
                      <span className="font-normal text-muted-foreground">
                        (payment link goes here)
                      </span>
                    </FieldLabel>
                    <Input
                      id="buyer-email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="buyer@company.com"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="buyer-phone">Phone</FieldLabel>
                    <Input
                      id="buyer-phone"
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="2547XXXXXXXX"
                      className="font-mono"
                    />
                  </Field>
                </div>
              )}
            </FieldGroup>
          </ConfidenceField>

          {/* ------------------------------------------------------- items -- */}
          <Field>
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <FieldLabel>Line items</FieldLabel>
              <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={busy}>
                <Plus data-icon="inline-start" />
                Add item
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-24">Qty</TableHead>
                  <TableHead className="w-40">Unit price ({currency})</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Remove</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row, i) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.confidence != null ? (
                        <ConfidenceField
                          label={`Item ${i + 1}`}
                          confidence={row.confidence}
                          confirmed={Boolean(confirmed[`item:${row.id}`])}
                          onConfirm={() => confirm(`item:${row.id}`)}
                        >
                          <Input
                            value={row.description}
                            onChange={(e) =>
                              updateRow(row.id, { description: e.target.value })
                            }
                            placeholder="e.g. French beans, fine grade"
                            disabled={busy}
                          />
                        </ConfidenceField>
                      ) : (
                        <Input
                          value={row.description}
                          onChange={(e) =>
                            updateRow(row.id, { description: e.target.value })
                          }
                          placeholder="e.g. French beans, fine grade"
                          disabled={busy}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={row.qty}
                        onChange={(e) => updateRow(row.id, { qty: e.target.value })}
                        disabled={busy}
                        className="font-mono"
                        aria-label={`Quantity for item ${i + 1}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step={priceStep}
                        inputMode="decimal"
                        value={row.unitPrice}
                        onChange={(e) =>
                          updateRow(row.id, { unitPrice: e.target.value })
                        }
                        placeholder={decimals(currency) === 0 ? "e.g. 230" : "e.g. 2.30"}
                        disabled={busy}
                        className="font-mono"
                        aria-label={`Unit price for item ${i + 1} in ${currency}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeRow(row.id)}
                        disabled={busy}
                        aria-label={`Remove item ${i + 1}`}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <FieldDescription>
              Prices are in {currency}. Leave a price empty if you only want to
              state the total.
            </FieldDescription>
          </Field>

          {/* ------------------------------------------------- amount/terms -- */}
          <ConfidenceField
            label="Currency"
            required
            confidence={result ? result.currency.confidence : null}
            snippet={result?.currency.snippet}
            deterministic={result?.currency.deterministic}
            demo={result?.currency.demo}
            confirmed={Boolean(confirmed["currency"])}
            onConfirm={() => confirm("currency")}
          >
            <ToggleGroup
              type="single"
              variant="outline"
              className="w-fit"
              value={currency}
              onValueChange={(v) => {
                if (isCurrency(v)) setCurrency(v);
              }}
            >
              {CURRENCY_CODES.map((code) => (
                <ToggleGroupItem key={code} value={code}>
                  {code}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </ConfidenceField>

          <ConfidenceField
            label={`Total (${currency})`}
            required
            confidence={result ? result.total.confidence : null}
            snippet={result?.total.snippet}
            deterministic={result?.total.deterministic}
            demo={result?.total.demo}
            confirmed={Boolean(confirmed["total"])}
            onConfirm={() => confirm("total")}
          >
            <Input
              id="invoice-total"
              type="number"
              min="0"
              step={priceStep}
              inputMode="decimal"
              value={totalDisplay}
              onChange={(e) => {
                setTotalText(e.target.value);
                // Clearing the override snaps back to the computed total.
                setTotalTouched(e.target.value !== "");
              }}
              disabled={busy}
              className="font-mono sm:max-w-xs"
              aria-label={`Invoice total in ${currency}`}
            />
            <FieldDescription>
              {!totalTouched && derivedTotalMinor != null
                ? "Computed live from your line items — edit to override."
                : totalTouched
                  ? "You set this total yourself — line items stay untouched."
                  : "In major units (e.g. 1150.00). Fills in automatically once every line has a qty and price."}
            </FieldDescription>
          </ConfidenceField>

          <ConfidenceField
            label="Due date"
            confidence={result ? result.dueDate.confidence : null}
            snippet={result?.dueDate.snippet}
            deterministic={result?.dueDate.deterministic}
            demo={result?.dueDate.demo}
            confirmed={Boolean(confirmed["dueDate"])}
            onConfirm={() => confirm("dueDate")}
          >
            <Input
              id="due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={busy}
              className="w-fit font-mono"
              aria-label="Due date"
            />
          </ConfidenceField>

          <Field>
            <FieldLabel htmlFor="invoice-notes">
              Notes for the buyer
              <span className="font-normal text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Textarea
              id="invoice-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the buyer should see on the invoice…"
              disabled={busy}
            />
          </Field>

          <Field>
            <FieldLabel>Who pays the collection fees?</FieldLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              className="w-fit"
              value={feeBearer}
              onValueChange={(v) => {
                if (v === "business" || v === "customer") setFeeBearer(v);
              }}
            >
              <ToggleGroupItem value="business">You pay fees</ToggleGroupItem>
              <ToggleGroupItem value="customer">Buyer pays fees</ToggleGroupItem>
            </ToggleGroup>
            <FieldDescription>
              {feeBearer === "business"
                ? "Fees come out of your payout — the buyer pays exactly the invoice total."
                : "Fees are added on top for the buyer — you receive the full invoice amount."}
            </FieldDescription>
          </Field>

          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="send-now">
                Send immediately after risk check
              </FieldLabel>
              <FieldDescription>
                Every invoice is screened before anything goes out. If a flag
                fires, it lands in your risk queue instead — fail-closed.
              </FieldDescription>
            </FieldContent>
            <Switch
              id="send-now"
              checked={sendNow}
              onCheckedChange={setSendNow}
              disabled={busy}
            />
          </Field>
        </FieldGroup>
      </CardContent>

      <CardFooter className="flex-wrap gap-2">
        {extraction && (
          <Button type="button" variant="ghost" onClick={onBack} disabled={busy}>
            <ArrowLeft data-icon="inline-start" />
            Back
          </Button>
        )}
        {!extraction && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <PenLine aria-hidden="true" className="size-3" />
            Manual entry — no AI involved
          </span>
        )}
        {lowUnconfirmedCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {lowUnconfirmedCount} low-confidence{" "}
            {lowUnconfirmedCount === 1 ? "field needs" : "fields need"} your
            confirmation
          </span>
        )}
        <Button type="button" className="ml-auto" onClick={submit} disabled={busy}>
          {busy ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Send data-icon="inline-start" />
          )}
          {busy ? "Creating & screening…" : "Create invoice"}
        </Button>
      </CardFooter>
    </Card>
  );
}

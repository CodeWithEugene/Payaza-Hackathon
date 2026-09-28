"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Landmark, Pencil, Plus, Smartphone } from "lucide-react";

import { saveRailAction } from "@/lib/actions/rails-partners";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export interface RailRow {
  id: string;
  rail: "mpesa" | "kepss_bank";
  phone: string | null;
  bankCode: string | null;
  accountNumber: string | null;
  accountName: string | null;
  verified: boolean;
  isDefault: boolean;
}

export interface BankOption {
  name?: string;
  code: string;
}

interface FormState {
  rail: "mpesa" | "kepss_bank";
  phone: string;
  accountNumber: string;
  bankCode: string;
  accountName: string;
  isDefault: boolean;
}

/** 254712345678 (stored) → 0712 345 678 (friendly Kenyan display). */
function displayPhone(phone: string): string {
  if (/^254\d{9}$/.test(phone)) {
    const local = `0${phone.slice(3)}`;
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  }
  return phone;
}

/** User input (07XX…, +254…, 254…) → the 254XXXXXXXXX form the action expects. */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  return digits;
}

/**
 * Payout rails — where your KES lands. One dialog serves both add and edit
 * (prefilled); every failure surfaces the server's persona copy verbatim.
 */
export function RailsCard({
  rails,
  bankOptions,
}: {
  rails: RailRow[];
  bankOptions: BankOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [editing, setEditing] = React.useState<RailRow | null>(null);
  const [form, setForm] = React.useState<FormState>({
    rail: "mpesa",
    phone: "",
    accountNumber: "",
    bankCode: "",
    accountName: "",
    isDefault: false,
  });

  function openAdd() {
    setEditing(null);
    setForm({
      rail: "mpesa",
      phone: "",
      accountNumber: "",
      bankCode: "",
      accountName: "",
      isDefault: rails.length === 0,
    });
    setOpen(true);
  }

  function openEdit(rail: RailRow) {
    setEditing(rail);
    setForm({
      rail: rail.rail,
      phone: rail.phone ? displayPhone(rail.phone) : "",
      accountNumber: rail.accountNumber ?? "",
      bankCode: rail.bankCode ?? "",
      accountName: rail.accountName ?? "",
      isDefault: rail.isDefault,
    });
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await saveRailAction({
      railId: editing?.id,
      rail: form.rail,
      phone: form.rail === "mpesa" ? normalizePhone(form.phone) : "",
      accountNumber: form.rail === "kepss_bank" ? form.accountNumber.trim() : "",
      accountName: form.accountName.trim(),
      bankCode: form.rail === "kepss_bank" ? form.bankCode.trim() : "",
      isDefault: form.isDefault,
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      toast.success(editing ? "Rail updated." : "Rail added. Payouts can land here.");
      router.refresh();
    } else {
      toast.error(res.error ?? "Could not save rail.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payout Rails: Where Your KES Lands</CardTitle>
        <CardDescription>
          Every payout lands on one of these: M-Pesa (minutes) or a kepss bank account (same
          day). The default rail is what auto-payout and one-tap payout use.
        </CardDescription>
        <CardAction>
          <Button onClick={openAdd}>
            <Plus data-icon="inline-start" />
            Add Rail
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {rails.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Smartphone />
              </EmptyMedia>
              <EmptyTitle>No Payout Rails Yet</EmptyTitle>
              <EmptyDescription>
                Add your M-Pesa number or bank account so settled invoices have somewhere to
                land.
              </EmptyDescription>
            </EmptyHeader>
            <Button onClick={openAdd}>
              <Plus data-icon="inline-start" />
              Add Your First Rail
            </Button>
          </Empty>
        ) : (
          <ItemGroup>
            {rails.map((rail) => {
              const isMpesa = rail.rail === "mpesa";
              const Icon = isMpesa ? Smartphone : Landmark;
              const primary = isMpesa
                ? rail.phone
                  ? displayPhone(rail.phone)
                  : "None"
                : rail.accountNumber ?? "None";
              return (
                <Item key={rail.id} variant="outline">
                  <ItemMedia variant="icon">
                    <Icon />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{rail.accountName || "Unnamed Rail"}</ItemTitle>
                    <ItemDescription>
                      <span className="font-mono text-foreground">{primary}</span>
                      {rail.bankCode ? (
                        <>
                          {" · "}
                          <span className="font-mono">{rail.bankCode}</span>
                        </>
                      ) : null}
                      {" · "}
                      {isMpesa ? "M-Pesa" : "Bank (kepss)"}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    {rail.isDefault ? <Badge variant="secondary">Default</Badge> : null}
                    {rail.verified ? <Badge variant="outline">Verified</Badge> : null}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${rail.accountName || "rail"}`}
                      title="Edit rail"
                      onClick={() => openEdit(rail)}
                    >
                      <Pencil />
                    </Button>
                  </ItemActions>
                </Item>
              );
            })}
          </ItemGroup>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Payout Rail" : "Add A Payout Rail"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update where this rail sends money. Changes apply to the next payout."
                : "Payouts convert everything to KES and land here: M-Pesa or a Kenyan bank account."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} noValidate>
            <FieldGroup>
              <Field>
                <FieldLabel>Rail type</FieldLabel>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={form.rail}
                  onValueChange={(value) => {
                    if (value === "mpesa" || value === "kepss_bank") {
                      setForm((f) => ({ ...f, rail: value }));
                    }
                  }}
                  className="w-full [&>[data-slot=toggle-group-item]]:flex-1"
                >
                  <ToggleGroupItem value="mpesa">
                    <Smartphone data-icon="inline-start" />
                    M-Pesa
                  </ToggleGroupItem>
                  <ToggleGroupItem value="kepss_bank">
                    <Landmark data-icon="inline-start" />
                    Bank (kepss)
                  </ToggleGroupItem>
                </ToggleGroup>
              </Field>

              {form.rail === "mpesa" ? (
                <Field>
                  <FieldLabel htmlFor="rail-phone">M-Pesa number</FieldLabel>
                  <Input
                    id="rail-phone"
                    className="font-mono"
                    placeholder="07XX XXX XXX"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    autoComplete="off"
                    inputMode="tel"
                  />
                  <FieldDescription>Safaricom M-Pesa. Payouts land in minutes.</FieldDescription>
                </Field>
              ) : (
                <>
                  <Field>
                    <FieldLabel htmlFor="rail-account">Account number</FieldLabel>
                    <Input
                      id="rail-account"
                      className="font-mono"
                      placeholder="e.g. 04512345678901"
                      value={form.accountNumber}
                      onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
                      autoComplete="off"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="rail-bank">Bank</FieldLabel>
                    {bankOptions.length > 0 ? (
                      <Select
                        value={form.bankCode}
                        onValueChange={(value) => setForm((f) => ({ ...f, bankCode: value }))}
                      >
                        <SelectTrigger id="rail-bank" className="w-full">
                          <SelectValue placeholder="Pick the bank" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {bankOptions.map((b) => (
                              <SelectItem key={b.code} value={b.code}>
                                {b.name ? `${b.name} · ${b.code}` : b.code}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="rail-bank"
                        className="font-mono"
                        placeholder="e.g. 000018 (Equity)"
                        value={form.bankCode}
                        onChange={(e) => setForm((f) => ({ ...f, bankCode: e.target.value }))}
                        autoComplete="off"
                      />
                    )}
                    <FieldDescription>
                      {bankOptions.length > 0
                        ? "Kenyan kepss bank codes, live from Payaza."
                        : "Bank codes couldn't be loaded. Enter the kepss code."}
                    </FieldDescription>
                  </Field>
                </>
              )}

              <Field>
                <FieldLabel htmlFor="rail-account-name">Name on the account</FieldLabel>
                <Input
                  id="rail-account-name"
                  placeholder="As registered with Safaricom / the bank"
                  value={form.accountName}
                  onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
                  autoComplete="off"
                />
              </Field>

              <Field orientation="horizontal">
                <Switch
                  id="rail-default"
                  checked={form.isDefault}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, isDefault: checked === true }))}
                />
                <FieldContent>
                  <FieldLabel htmlFor="rail-default">Default rail</FieldLabel>
                  <FieldDescription>
                    Payouts use this rail unless you pick another one.
                  </FieldDescription>
                </FieldContent>
              </Field>
            </FieldGroup>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? <Spinner data-icon="inline-start" /> : null}
                {editing ? "Save Changes" : "Add Rail"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

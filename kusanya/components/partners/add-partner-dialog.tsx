"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, UserPlus } from "lucide-react";

import { createPartnerAction } from "@/lib/actions/rails-partners";
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
  Field,
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
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

export interface BankOption {
  name?: string;
  code: string;
}

interface FormState {
  name: string;
  email: string;
  accountNo: string;
  accountName: string;
  bankCode: string;
  sharePct: string;
}

const EMPTY: FormState = {
  name: "",
  email: "",
  accountNo: "",
  accountName: "",
  bankCode: "",
  sharePct: "",
};

/**
 * Add partner → registers a Payaza split account (SSA code). The UI always
 * speaks PARTNER SHARE; the server stores Payaza's inverted split_value.
 */
export function AddPartnerDialog({ bankOptions }: { bankOptions: BankOption[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [invalid, setInvalid] = React.useState<Partial<Record<keyof FormState, boolean>>>({});

  const set = (key: keyof FormState) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setInvalid((i) => ({ ...i, [key]: false }));
  };

  function validate(): string | null {
    if (form.name.trim().length < 2) return "Enter the partner's full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "Enter a valid email. Payaza sends split receipts there.";
    if (form.accountNo.trim().length < 4) return "Enter the partner's account or M-Pesa number.";
    if (form.accountName.trim().length < 2) return "Enter the name registered on that account.";
    if (form.bankCode.trim().length < 2) return "Pick the bank or M-Pesa code.";
    const pct = Number(form.sharePct);
    if (!Number.isFinite(pct) || pct < 0.5 || pct > 99.5) {
      return "Partner share must be between 0.5% and 99.5%.";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const firstError = validate();
    if (firstError) {
      setInvalid({
        name: form.name.trim().length < 2,
        email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()),
        accountNo: form.accountNo.trim().length < 4,
        accountName: form.accountName.trim().length < 2,
        bankCode: form.bankCode.trim().length < 2,
        sharePct: !Number.isFinite(Number(form.sharePct)) || Number(form.sharePct) < 0.5 || Number(form.sharePct) > 99.5,
      });
      toast.error(firstError);
      return;
    }
    setBusy(true);
    const res = await createPartnerAction({
      name: form.name.trim(),
      email: form.email.trim(),
      accountNo: form.accountNo.trim(),
      accountName: form.accountName.trim(),
      bankCode: form.bankCode.trim(),
      sharePct: Number(form.sharePct),
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      setForm(EMPTY);
      setInvalid({});
      toast.success("Partner created and Payaza split account registered.");
      router.refresh();
    } else {
      toast.error(res.error ?? "Could not add partner.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setForm(EMPTY);
          setInvalid({});
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" />
          Add Partner
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add A Partner</DialogTitle>
          <DialogDescription>
            Registers a Payaza split account. From the invoices you attach them to, their share
            is paid out automatically the moment a collection completes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate>
          <FieldGroup>
            <Field data-invalid={invalid.name || undefined}>
              <FieldLabel htmlFor="partner-name">Partner name</FieldLabel>
              <Input
                id="partner-name"
                placeholder="e.g. Achieng Freight Ltd"
                value={form.name}
                onChange={(e) => set("name")(e.target.value)}
                aria-invalid={invalid.name || undefined}
                autoComplete="off"
              />
            </Field>
            <Field data-invalid={invalid.email || undefined}>
              <FieldLabel htmlFor="partner-email">Email</FieldLabel>
              <Input
                id="partner-email"
                type="email"
                placeholder="partner@example.com"
                value={form.email}
                onChange={(e) => set("email")(e.target.value)}
                aria-invalid={invalid.email || undefined}
                autoComplete="off"
              />
              <FieldDescription>Payaza sends their split receipts here.</FieldDescription>
            </Field>
            <Field data-invalid={invalid.accountNo || undefined}>
              <FieldLabel htmlFor="partner-account-no">Account / M-Pesa number</FieldLabel>
              <Input
                id="partner-account-no"
                className="font-mono"
                placeholder="0712345678 or bank account no."
                value={form.accountNo}
                onChange={(e) => set("accountNo")(e.target.value)}
                aria-invalid={invalid.accountNo || undefined}
                autoComplete="off"
              />
            </Field>
            <Field data-invalid={invalid.accountName || undefined}>
              <FieldLabel htmlFor="partner-account-name">Name on the account</FieldLabel>
              <Input
                id="partner-account-name"
                placeholder="As registered with the bank / Safaricom"
                value={form.accountName}
                onChange={(e) => set("accountName")(e.target.value)}
                aria-invalid={invalid.accountName || undefined}
                autoComplete="off"
              />
            </Field>
            <Field data-invalid={invalid.bankCode || undefined}>
              <FieldLabel htmlFor="partner-bank-code">Bank or M-Pesa</FieldLabel>
              {bankOptions.length > 0 ? (
                <Select value={form.bankCode} onValueChange={set("bankCode")}>
                  <SelectTrigger id="partner-bank-code" className="w-full" aria-invalid={invalid.bankCode || undefined}>
                    <SelectValue placeholder="Pick where they bank" />
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
                  id="partner-bank-code"
                  className="font-mono"
                  placeholder="e.g. SAFKEN"
                  value={form.bankCode}
                  onChange={(e) => set("bankCode")(e.target.value)}
                  aria-invalid={invalid.bankCode || undefined}
                  autoComplete="off"
                />
              )}
              <FieldDescription>
                {bankOptions.length > 0
                  ? "Kenyan bank and M-Pesa codes, live from Payaza."
                  : "Bank codes couldn't be loaded. Enter the code (e.g. SAFKEN for M-Pesa)."}
              </FieldDescription>
            </Field>
            <Field data-invalid={invalid.sharePct || undefined}>
              <FieldLabel htmlFor="partner-share">Partner share (%)</FieldLabel>
              <Input
                id="partner-share"
                type="number"
                inputMode="decimal"
                min={0.5}
                max={99.5}
                step={0.5}
                placeholder="e.g. 10"
                value={form.sharePct}
                onChange={(e) => set("sharePct")(e.target.value)}
                aria-invalid={invalid.sharePct || undefined}
              />
              <FieldDescription>Percentage of each collection this partner receives.</FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Spinner data-icon="inline-start" /> : <UserPlus data-icon="inline-start" />}
              Create Partner
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

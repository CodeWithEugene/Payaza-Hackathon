"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateSettingsAction } from "@/lib/actions/rails-partners";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
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

type FeeBearer = "business" | "customer";
type ConfirmationPolicy = "always_ask" | "trusted_buyers";
type NotifyChannel = "email" | "sms";

/** Defensive read of the businesses.settings jsonb — defaults mirror the schema. */
function readSettings(settings: Record<string, unknown>) {
  return {
    autoPayout: settings.autoPayout === true,
    feeBearer: (settings.feeBearer === "customer" ? "customer" : "business") as FeeBearer,
    notifyChannels: (
      Array.isArray(settings.notifyChannels)
        ? (settings.notifyChannels as unknown[]).filter(
            (c): c is NotifyChannel => c === "email" || c === "sms",
          )
        : ["email"]
    ) as NotifyChannel[],
    confirmationPolicy: (
      settings.confirmationPolicy === "trusted_buyers" ? "trusted_buyers" : "always_ask"
    ) as ConfirmationPolicy,
  };
}

/** Business preferences — merged into businesses.settings by updateSettingsAction. */
export function PreferencesCard({
  settings,
  demoMode,
}: {
  settings: Record<string, unknown>;
  demoMode: boolean;
}) {
  const router = useRouter();
  const initial = React.useMemo(() => readSettings(settings), [settings]);
  const [busy, setBusy] = React.useState(false);
  const [autoPayout, setAutoPayout] = React.useState(initial.autoPayout);
  const [feeBearer, setFeeBearer] = React.useState<FeeBearer>(initial.feeBearer);
  const [notifyChannels, setNotifyChannels] = React.useState<NotifyChannel[]>(initial.notifyChannels);
  const [confirmationPolicy, setConfirmationPolicy] =
    React.useState<ConfirmationPolicy>(initial.confirmationPolicy);

  function toggleChannel(channel: NotifyChannel, checked: boolean) {
    setNotifyChannels((prev) =>
      checked ? [...new Set([...prev, channel])] : prev.filter((c) => c !== channel),
    );
  }

  async function handleSave() {
    setBusy(true);
    const res = await updateSettingsAction({
      autoPayout,
      feeBearer,
      notifyChannels,
      confirmationPolicy,
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Preferences saved.");
      router.refresh();
    } else {
      toast.error(res.error ?? "Could not save settings.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>
          How Kusanya handles fees, payouts and notifications for your business.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field orientation="horizontal">
            <Switch
              id="pref-auto-payout"
              checked={autoPayout}
              onCheckedChange={(checked) => setAutoPayout(checked === true)}
            />
            <FieldContent>
              <FieldLabel htmlFor="pref-auto-payout">
                Auto-payout settled invoices to my default rail
              </FieldLabel>
              <FieldDescription>Off by default: you confirm every payout.</FieldDescription>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel>Fees paid by</FieldLabel>
            <FieldDescription>
              Who absorbs the Payaza + rail fees on each new invoice. You can still change it
              per invoice.
            </FieldDescription>
            <ToggleGroup
              type="single"
              variant="outline"
              value={feeBearer}
              onValueChange={(value) => {
                if (value === "business" || value === "customer") setFeeBearer(value);
              }}
              className="w-fit"
            >
              <ToggleGroupItem value="business">Business (you)</ToggleGroupItem>
              <ToggleGroupItem value="customer">Customer</ToggleGroupItem>
            </ToggleGroup>
          </Field>

          <Field>
            <FieldLabel htmlFor="pref-policy">Payout confirmation</FieldLabel>
            <FieldDescription>
              A second check before money leaves your wallet. Kusanya never stores a payout
              PIN.
            </FieldDescription>
            <Select
              value={confirmationPolicy}
              onValueChange={(value) => {
                if (value === "always_ask" || value === "trusted_buyers") {
                  setConfirmationPolicy(value);
                }
              }}
            >
              <SelectTrigger id="pref-policy" className="w-full sm:max-w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="always_ask">Always ask for a confirmation code</SelectItem>
                  <SelectItem value="trusted_buyers">Trusted buyers skip the code</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <FieldSet>
            <FieldLegend variant="label">Notify me via</FieldLegend>
            <Field orientation="horizontal">
              <Checkbox
                id="pref-notify-email"
                checked={notifyChannels.includes("email")}
                onCheckedChange={(checked) => toggleChannel("email", checked === true)}
              />
              <FieldContent>
                <FieldLabel htmlFor="pref-notify-email">Email</FieldLabel>
                <FieldDescription>Receipts, reminders and payout outcomes.</FieldDescription>
              </FieldContent>
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id="pref-notify-sms"
                checked={notifyChannels.includes("sms")}
                onCheckedChange={(checked) => toggleChannel("sms", checked === true)}
              />
              <FieldContent>
                <FieldLabel htmlFor="pref-notify-sms">SMS</FieldLabel>
                <FieldDescription>
                  Short alerts to your Kenyan number, including &quot;Imefika!&quot; when a
                  payout lands.
                </FieldDescription>
              </FieldContent>
            </Field>
          </FieldSet>
        </FieldGroup>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {demoMode
            ? "Demo Mode: preferences persist on the demo business, and “Reset Demo Data” restores the seeded defaults."
            : "Applies to new invoices and payouts immediately."}
        </p>
        <Button onClick={handleSave} disabled={busy}>
          {busy ? <Spinner data-icon="inline-start" /> : null}
          Save Preferences
        </Button>
      </CardFooter>
    </Card>
  );
}

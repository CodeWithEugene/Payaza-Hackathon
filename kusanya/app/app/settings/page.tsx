import type { Metadata } from "next";
import { asc, desc, eq } from "drizzle-orm";
import { Building2, Globe, Hash, ShieldCheck } from "lucide-react";

import { requireBusiness } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { payoutRails } from "@/lib/db/schema";
import { env } from "@/lib/config/env";
import { bankCodes } from "@/lib/payaza/endpoints";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { DemoCard } from "@/components/settings/demo-card";
import { PreferencesCard } from "@/components/settings/preferences-card";
import { RailsCard, type RailRow } from "@/components/settings/rails-card";

export const metadata: Metadata = { title: "Settings" };

const COUNTRY_NAMES: Record<string, string> = {
  KE: "Kenya",
  UG: "Uganda",
  TZ: "Tanzania",
  US: "United States",
  GB: "United Kingdom",
};

export default async function SettingsPage() {
  const { business } = await requireBusiness();

  const rails = await db
    .select()
    .from(payoutRails)
    .where(eq(payoutRails.businessId, business.id))
    .orderBy(desc(payoutRails.isDefault), asc(payoutRails.createdAt));

  // Bank codes for the rail dialog — fall back to a free-text code input.
  let bankOptions: { name?: string; code: string }[] = [];
  try {
    const resp = await bankCodes("KES");
    const list = Array.isArray(resp.data) ? (resp.data as Record<string, unknown>[]) : [];
    bankOptions = list
      .map((b) => ({
        name: typeof b.bankName === "string" ? b.bankName : undefined,
        code: String(b.bankCode ?? ""),
      }))
      .filter((b) => b.code.length > 0);
  } catch {
    bankOptions = [];
  }

  // Plain serializable rows for the client cards (no Date objects across the wire).
  const railRows: RailRow[] = rails.map((r) => ({
    id: r.id,
    rail: r.rail,
    phone: r.phone,
    bankCode: r.bankCode,
    accountNumber: r.accountNumber,
    accountName: r.accountName,
    verified: r.verified,
    isDefault: r.isDefault,
  }));

  const settings =
    business.settings && typeof business.settings === "object" && !Array.isArray(business.settings)
      ? (business.settings as Record<string, unknown>)
      : {};

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your business profile, payout rails, preferences — and the demo facts, when Demo
          Mode is on.
        </p>
      </div>

      {/* ------------------------------------------------------- business -- */}
      <Card>
        <CardHeader>
          <CardTitle>Business</CardTitle>
          <CardDescription>
            Your Kusanya business profile — the identity buyers see at checkout.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ItemGroup>
            <Item variant="muted">
              <ItemMedia variant="icon">
                <Building2 />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Name</ItemTitle>
                <ItemDescription>{business.name}</ItemDescription>
              </ItemContent>
            </Item>
            <Item variant="muted">
              <ItemMedia variant="icon">
                <Globe />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Country</ItemTitle>
                <ItemDescription>
                  {COUNTRY_NAMES[business.country] ?? business.country} ({business.country})
                </ItemDescription>
              </ItemContent>
            </Item>
            <Item variant="muted">
              <ItemMedia variant="icon">
                <ShieldCheck />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>KYC tier</ItemTitle>
                <ItemDescription>
                  Mirrors Payaza&apos;s test/live gates: tier 1 carries small limits, tier 2
                  unlocks full volumes.
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Badge variant="secondary">Tier {business.kycTier}</Badge>
              </ItemActions>
            </Item>
            <Item variant="muted">
              <ItemMedia variant="icon">
                <Hash />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Slug</ItemTitle>
                <ItemDescription className="font-mono">{business.slug}</ItemDescription>
              </ItemContent>
            </Item>
          </ItemGroup>
          <p className="mt-3 text-xs text-muted-foreground">
            Read-only — managed by the hackathon team.
          </p>
        </CardContent>
      </Card>

      <RailsCard rails={railRows} bankOptions={bankOptions} />
      <PreferencesCard settings={settings} demoMode={env.DEMO_MODE} />
      <DemoCard demoMode={env.DEMO_MODE} />
    </div>
  );
}

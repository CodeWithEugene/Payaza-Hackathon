import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, FileJson } from "lucide-react";

import { requireBusiness } from "@/lib/auth/guards";
import { env } from "@/lib/config/env";
import { listApiKeys } from "@/lib/services/api-keys";
import { buildSnippets } from "@/lib/developers/snippets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiKeysCard, type KeyRow } from "@/components/developers/api-keys-card";
import { CopyButton } from "@/components/developers/code-block";
import { CodeTabs } from "@/components/developers/code-tabs";

export const metadata: Metadata = { title: "Developers" };

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Nairobi",
});

/** API key management + base URL + quickstart for this business. */
export default async function AppDevelopersPage() {
  const { business } = await requireBusiness();
  const keys = await listApiKeys(business.id);
  const baseUrl = `${env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/api/v1`;

  const rows: KeyRow[] = keys.map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    created: dateFmt.format(new Date(k.createdAt)),
    lastUsed: k.lastUsedAt ? dateFmt.format(new Date(k.lastUsedAt)) : null,
    revoked: k.revokedAt ? dateFmt.format(new Date(k.revokedAt)) : null,
  }));

  const quickstart = buildSnippets({ method: "GET", url: `${baseUrl}/invoices?limit=5` });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-semibold tracking-tight">Developers</h1>
        <p className="text-muted-foreground text-sm">
          Connect your own systems to {business.name} on Kusanya: create and send invoices, extract orders from
          chat text, and read your payments ledger over a REST API.
        </p>
      </div>

      <ApiKeysCard keys={rows} />

      <Card>
        <CardHeader>
          <CardTitle>Base URL</CardTitle>
          <CardDescription>Every endpoint is relative to this URL. All keys run on the Payaza sandbox.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/60 border-border flex min-w-0 items-center justify-between gap-2 rounded-lg border py-1 pr-1 pl-3">
            <code className="min-w-0 font-mono text-sm break-all">{baseUrl}</code>
            <CopyButton text={baseUrl} label="Copy URL" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quickstart</CardTitle>
          <CardDescription>
            Export your key as KUSANYA_API_KEY, then list your five most recent invoices.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <CodeTabs snippets={quickstart} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/developers">
                <BookOpen data-icon="inline-start" />
                Read The Docs
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <a href={`${baseUrl}/openapi.json`} target="_blank" rel="noopener noreferrer">
                <FileJson data-icon="inline-start" />
                View OpenAPI Spec
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

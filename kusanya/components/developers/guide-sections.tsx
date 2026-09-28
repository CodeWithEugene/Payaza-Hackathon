import Link from "next/link";
import { FileJson, FlaskConical, KeyRound, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ERROR_DOCS } from "@/lib/developers/endpoints";
import { RATE_LIMITS } from "@/lib/api/v1/limits";
import { buildSnippets } from "@/lib/developers/snippets";
import { CodeBlock, CopyButton } from "./code-block";
import { CodeTabs } from "./code-tabs";
import { RichText } from "./rich-text";

/** Shared prose wrapper: consistent heading + spacing for guide sections. */
export function DocSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-4">
      <h2 className="font-heading text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="text-muted-foreground flex flex-col gap-4 text-sm leading-relaxed [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-[0.8rem]">{children}</code>;
}

export function OverviewSection({ baseUrl }: { baseUrl: string }) {
  const facts = [
    { icon: KeyRound, title: "Bearer Keys", body: "One secret key per integration, scoped to your business." },
    { icon: FlaskConical, title: "Payaza Sandbox", body: "Every key is a test key. No real money moves." },
    { icon: FileJson, title: "JSON Everywhere", body: "Consistent data and error envelope on every response." },
  ];
  return (
    <section id="overview" className="flex scroll-mt-24 flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="text-primary text-sm font-medium">Kusanya API v1</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          Build On Kusanya
        </h1>
        <p className="text-muted-foreground max-w-2xl text-pretty md:text-lg">
          The same invoicing and collections engine that powers the Kusanya dashboard, available to your own
          systems. Create invoices that carry Payaza payment links, turn chat orders into invoice fields with
          AI, and read your payments ledger.
        </p>
      </div>
      <Card size="sm">
        <CardHeader>
          <CardTitle>Base URL</CardTitle>
          <CardDescription>All endpoints below are relative to this URL.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/60 border-border flex min-w-0 items-center justify-between gap-2 rounded-lg border py-1 pr-1 pl-3">
            <code className="min-w-0 font-mono text-sm break-all">{baseUrl}</code>
            <CopyButton text={baseUrl} label="Copy URL" />
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-3 sm:grid-cols-3">
        {facts.map((f) => (
          <Card key={f.title} size="sm">
            <CardHeader>
              <f.icon className="text-primary size-5" aria-hidden="true" />
              <CardTitle>{f.title}</CardTitle>
              <CardDescription>{f.body}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function QuickstartSection({ baseUrl }: { baseUrl: string }) {
  const list = buildSnippets({ method: "GET", url: `${baseUrl}/invoices?limit=5` });
  const create = buildSnippets({
    method: "POST",
    url: `${baseUrl}/invoices`,
    body: {
      buyer: { name: "Dubai Fresh FZE", email: "susan@dubaifresh.ae", country: "AE" },
      currency: "USD",
      line_items: [{ description: "French beans (kg)", quantity: 500, unit_price_minor: "230" }],
      due_date: "2026-10-15",
      send: true,
    },
  });
  return (
    <DocSection id="quickstart" title="Quickstart">
      <ol className="flex list-decimal flex-col gap-4 pl-5 marker:font-semibold">
        <li className="flex flex-col gap-2">
          <p>
            <strong>Create an API key.</strong> Sign in, open Developers in the sidebar and choose Create API Key.
            The full secret is shown once, so store it in your secrets manager straight away.
          </p>
          <div>
            <Button asChild size="sm">
              <Link href="/app/developers">Get API Keys</Link>
            </Button>
          </div>
        </li>
        <li className="flex flex-col gap-2">
          <p>
            <strong>Keep the key in an environment variable.</strong> Every sample on this page reads it from{" "}
            <InlineCode>KUSANYA_API_KEY</InlineCode>.
          </p>
          <CodeBlock caption="Shell" code={'export KUSANYA_API_KEY="ksn_test_your_secret_key"'} />
        </li>
        <li className="flex flex-col gap-2">
          <p>
            <strong>Make your first request.</strong> List your five most recent invoices.
          </p>
          <CodeTabs snippets={list} />
        </li>
        <li className="flex flex-col gap-2">
          <p>
            <strong>Create and send an invoice.</strong> Kusanya screens it for risk, creates the Payaza payment
            link and emails the buyer their pay link. The response includes <InlineCode>pay_url</InlineCode>, the
            hosted page where the buyer pays by card or mobile money.
          </p>
          <CodeTabs snippets={create} />
        </li>
      </ol>
    </DocSection>
  );
}

export function AuthenticationSection() {
  return (
    <DocSection id="authentication" title="Authentication">
      <p>
        Authenticate every request by sending your secret key in the <InlineCode>Authorization</InlineCode>{" "}
        header as a bearer token. Keys belong to one business, and every request only ever sees that
        business&apos;s invoices, buyers and payments.
      </p>
      <CodeBlock caption="HTTP" code={"Authorization: Bearer ksn_test_your_secret_key"} />
      <ul className="flex list-disc flex-col gap-2 pl-5">
        <li>Keys look like <InlineCode>ksn_test_</InlineCode> followed by 40 letters and digits.</li>
        <li>
          Kusanya stores only a SHA-256 hash of each key. The full secret is shown once when you create it and
          cannot be shown again. If you lose it, create a new key and revoke the old one.
        </li>
        <li>Revoking a key in the dashboard takes effect on the next request.</li>
        <li>
          Call the API from your server. Never put a key in browser code, a mobile app or a public repository.
        </li>
      </ul>
      <p>A missing or unknown key returns 401:</p>
      <CodeBlock
        caption="401 Unauthorized"
        code={JSON.stringify(
          { data: null, error: { code: "unauthorized", message: "Invalid API key." } },
          null,
          2,
        )}
      />
    </DocSection>
  );
}

export function TestModeSection() {
  return (
    <DocSection id="test-mode" title="Test Mode">
      <Alert>
        <ShieldCheck />
        <AlertTitle>All Keys Run On The Payaza Sandbox</AlertTitle>
        <AlertDescription>
          Kusanya issues test keys only. Payment links, card checkouts and mobile money prompts use Payaza test
          rails, so no real money moves.
        </AlertDescription>
      </Alert>
      <p>
        Invoices you create through the API are real records in your Kusanya business. They appear in the
        dashboard, in the risk queue when screening flags them, and in your payments ledger once a buyer pays on
        the sandbox. Deployments running in Demo Mode serve recorded Payaza responses instead of calling the
        sandbox.
      </p>
    </DocSection>
  );
}

const CURRENCY_ROWS = [
  { code: "USD", unit: "cents (2 decimals)", example: "115000", reads: "USD 1,150.00" },
  { code: "KES", unit: "cents (2 decimals)", example: "250000", reads: "KES 2,500.00" },
  { code: "UGX", unit: "shillings (0 decimals)", example: "500000", reads: "UGX 500,000" },
  { code: "TZS", unit: "shillings (0 decimals)", example: "300000", reads: "TZS 300,000" },
];

export function MoneySection() {
  return (
    <DocSection id="money" title="Money Format">
      <p>
        Every amount is an integer number of minor units, encoded as a string, in a field ending in{" "}
        <InlineCode>_minor</InlineCode>. The currency is always in the adjacent <InlineCode>currency</InlineCode>{" "}
        field. Amounts are never floats, so there is no rounding drift between your books and ours.
      </p>
      <div className="border-border overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Currency</TableHead>
              <TableHead>Minor Unit</TableHead>
              <TableHead>Example</TableHead>
              <TableHead>Means</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CURRENCY_ROWS.map((r) => (
              <TableRow key={r.code}>
                <TableCell className="font-mono text-xs font-semibold">{r.code}</TableCell>
                <TableCell>{r.unit}</TableCell>
                <TableCell className="font-mono text-xs">&quot;{r.example}&quot;</TableCell>
                <TableCell>{r.reads}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p>
        In request bodies, <InlineCode>unit_price_minor</InlineCode> accepts the string form (preferred) or a JSON
        integer. Decimals such as <InlineCode>&quot;11.50&quot;</InlineCode> are rejected with a validation error.
      </p>
    </DocSection>
  );
}

const STATUS_ROWS: [string, string][] = [
  ["draft", "Saved but not yet screened or finalized."],
  ["ready", "Passed the risk screen and has a Payaza payment link. Not sent yet."],
  ["sent", "Delivered to the buyer by email or SMS."],
  ["partially_paid", "Some money has arrived, but less than the invoice total."],
  ["paid", "Fully paid by the buyer."],
  ["settling", "Payaza is settling the funds into your wallet."],
  ["settled", "Funds have settled and are ready to pay out."],
  ["paying_out", "A payout to your M-Pesa or bank account is in progress."],
  ["completed", "Paid out. The money is in your account."],
  ["failed", "A payment or payout failed."],
  ["cancelled", "Cancelled from the dashboard or the risk queue."],
  ["review", "Flagged by the risk screen for a person to check before it can be sent."],
  ["on_hold", "Held by the risk screen as high risk."],
];

export function StatusesSection() {
  return (
    <DocSection id="statuses" title="Invoice Statuses">
      <p>
        The <InlineCode>status</InlineCode> field follows the invoice from creation to payout. Filter on it with
        List Invoices.
      </p>
      <div className="border-border overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">Status</TableHead>
              <TableHead>Meaning</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {STATUS_ROWS.map(([status, meaning]) => (
              <TableRow key={status}>
                <TableCell className="font-mono text-xs font-semibold">{status}</TableCell>
                <TableCell className="whitespace-normal">{meaning}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DocSection>
  );
}

export function PaginationSection() {
  return (
    <DocSection id="pagination" title="Pagination">
      <p>
        List endpoints are paginated with <InlineCode>page</InlineCode> (starting at 1) and{" "}
        <InlineCode>limit</InlineCode> (1 to 100, default 25). Results are ordered newest first. Each list
        response carries a <InlineCode>pagination</InlineCode> object next to <InlineCode>data</InlineCode>;
        keep requesting the next page while <InlineCode>has_more</InlineCode> is true.
      </p>
      <CodeBlock
        caption="List response"
        code={JSON.stringify(
          { data: ["..."], error: null, pagination: { page: 2, limit: 25, total: 61, has_more: true } },
          null,
          2,
        )}
      />
    </DocSection>
  );
}

export function ErrorsSection() {
  return (
    <DocSection id="errors" title="Errors">
      <p>
        Every response has the same envelope. On success <InlineCode>error</InlineCode> is null; on failure{" "}
        <InlineCode>data</InlineCode> is null and <InlineCode>error</InlineCode> holds a stable machine readable{" "}
        <InlineCode>code</InlineCode> and a human readable <InlineCode>message</InlineCode>. Validation errors
        also list each invalid field in <InlineCode>details</InlineCode>.
      </p>
      <CodeBlock
        caption="400 Bad Request"
        code={JSON.stringify(
          {
            data: null,
            error: {
              code: "validation_error",
              message: "Request validation failed.",
              details: [
                { path: "currency", message: 'Invalid option: expected one of "USD"|"KES"|"UGX"|"TZS"' },
                { path: "line_items.0.quantity", message: "Too small: expected number to be >0" },
              ],
            },
          },
          null,
          2,
        )}
      />
      <div className="border-border overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Status</TableHead>
              <TableHead className="w-40">Code</TableHead>
              <TableHead>Meaning</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ERROR_DOCS.map((e) => (
              <TableRow key={e.code}>
                <TableCell className="font-mono text-xs">{e.status}</TableCell>
                <TableCell className="font-mono text-xs font-semibold">{e.code}</TableCell>
                <TableCell className="whitespace-normal">
                  <RichText text={e.meaning} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DocSection>
  );
}

export function RateLimitsSection() {
  const rows = [
    { scope: "Per API key", limit: RATE_LIMITS.perKey.limit, applies: "All authenticated endpoints" },
    { scope: "Per API key", limit: RATE_LIMITS.extractPerKey.limit, applies: "POST /extract (counts toward the key limit too)" },
    { scope: "Per IP address", limit: RATE_LIMITS.perIp.limit, applies: "All /api/v1 requests" },
  ];
  return (
    <DocSection id="rate-limits" title="Rate Limits">
      <p>
        Limits use fixed one minute windows. When you exceed one, the API returns 429 with a{" "}
        <InlineCode>Retry-After</InlineCode> header in seconds. Back off for that long, then retry.
      </p>
      <div className="border-border overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Scope</TableHead>
              <TableHead>Requests Per Minute</TableHead>
              <TableHead>Applies To</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.applies}>
                <TableCell>{r.scope}</TableCell>
                <TableCell className="font-mono text-xs">{r.limit}</TableCell>
                <TableCell className="whitespace-normal">{r.applies}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DocSection>
  );
}

export function OpenApiSection({ specUrl }: { specUrl: string }) {
  return (
    <DocSection id="openapi-spec" title="OpenAPI Spec">
      <p>
        A complete OpenAPI 3.1 description of every endpoint on this page is public at{" "}
        <InlineCode>/api/v1/openapi.json</InlineCode>. Import it into Postman or Insomnia, or feed it to an
        OpenAPI generator to get a typed client.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <a href={specUrl} target="_blank" rel="noopener noreferrer">
            <FileJson data-icon="inline-start" />
            View OpenAPI Spec
          </a>
        </Button>
      </div>
      <CodeBlock caption="Shell" code={`curl -o kusanya-openapi.json "${specUrl}"`} />
    </DocSection>
  );
}

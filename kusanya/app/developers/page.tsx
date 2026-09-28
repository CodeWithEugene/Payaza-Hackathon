import type { Metadata } from "next";
import Link from "next/link";

import { env } from "@/lib/config/env";
import { ENDPOINTS } from "@/lib/developers/endpoints";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { KusanyaMark } from "@/components/brand/logo";
import { ModeToggle } from "@/components/mode-toggle";
import { DocsNav, type NavGroup } from "@/components/developers/docs-nav";
import { EndpointSection } from "@/components/developers/endpoint-section";
import {
  AuthenticationSection,
  ErrorsSection,
  MoneySection,
  OpenApiSection,
  OverviewSection,
  PaginationSection,
  QuickstartSection,
  RateLimitsSection,
  StatusesSection,
  TestModeSection,
} from "@/components/developers/guide-sections";

export const metadata: Metadata = {
  title: "Developer Docs",
  description:
    "Kusanya API v1 reference: create invoices with Payaza payment links, extract invoice fields from chat orders, and read your payments ledger.",
};

const NAV: NavGroup[] = [
  {
    title: "Getting Started",
    items: [
      { id: "overview", label: "Overview" },
      { id: "quickstart", label: "Quickstart" },
      { id: "authentication", label: "Authentication" },
      { id: "test-mode", label: "Test Mode" },
    ],
  },
  {
    title: "Concepts",
    items: [
      { id: "money", label: "Money Format" },
      { id: "statuses", label: "Invoice Statuses" },
      { id: "pagination", label: "Pagination" },
      { id: "errors", label: "Errors" },
      { id: "rate-limits", label: "Rate Limits" },
    ],
  },
  {
    title: "API Reference",
    items: ENDPOINTS.filter((e) => e.id !== "openapi").map((e) => ({ id: e.id, label: e.title, method: e.method })),
  },
  {
    title: "Tools",
    items: [{ id: "openapi-spec", label: "OpenAPI Spec" }],
  },
];

/** Public developer documentation (no sign-in). */
export default function DevelopersPage() {
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  const baseUrl = `${appUrl}/api/v1`;
  const reference = ENDPOINTS.filter((e) => e.id !== "openapi");

  return (
    <div className="bg-background text-foreground flex min-h-svh flex-col">
      <header className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <Link href="/" className="flex items-center gap-2">
              <KusanyaMark className="size-8" />
              <span className="font-heading text-lg font-semibold tracking-tight">kusanya</span>
            </Link>
            <Badge variant="secondary">Developers</Badge>
          </div>
          <nav className="flex items-center gap-1 sm:gap-2">
            <ModeToggle />
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/app/developers">Get API Keys</Link>
            </Button>
          </nav>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-8 px-4 py-8 md:px-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12 lg:py-12">
        <DocsNav groups={NAV} />
        <main className="flex min-w-0 flex-col gap-12">
          <OverviewSection baseUrl={baseUrl} />
          <QuickstartSection baseUrl={baseUrl} />
          <AuthenticationSection />
          <TestModeSection />
          <MoneySection />
          <StatusesSection />
          <PaginationSection />
          <ErrorsSection />
          <RateLimitsSection />

          <section id="reference" className="flex scroll-mt-24 flex-col gap-3">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">API Reference</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Every endpoint below is live on this deployment at <code className="font-mono">{baseUrl}</code>.
            </p>
          </section>
          {reference.map((endpoint) => (
            <EndpointSection key={endpoint.id} endpoint={endpoint} baseUrl={baseUrl} />
          ))}

          <Separator />
          <OpenApiSection specUrl={`${baseUrl}/openapi.json`} />
        </main>
      </div>

      <footer className="border-border border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm md:px-8">
          <span>Kusanya API v1 on Payaza rails</span>
          <Link href="/" className="hover:text-foreground underline-offset-4 hover:underline">
            Back to kusanya
          </Link>
        </div>
      </footer>
    </div>
  );
}

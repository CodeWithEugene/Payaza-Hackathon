import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { invoices } from "@/lib/db/schema";
import { requireBusiness } from "@/lib/auth/guards";
import { env } from "@/lib/config/env";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { LiveUpdates } from "@/components/layout/live-updates";

/** Merchant app shell — session + business required (server-rendered). */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, business } = await requireBusiness();
  const [queue] = await db
    .select({ n: sql<number>`count(*)` })
    .from(invoices)
    .where(
      and(
        eq(invoices.businessId, business.id),
        inArray(invoices.status, ["review", "on_hold"]),
      ),
    );

  return (
    <SidebarProvider data-app-shell="" className="k-app-canvas">
      <AppSidebar businessName={business.name} reviewCount={Number(queue?.n ?? 0)} />
      <div className="flex min-h-svh w-full min-w-0 flex-1 flex-col">
        <Topbar
          userName={user.name}
          demoMode={env.DEMO_MODE}
          sandbox={env.SANDBOX_RAILS}
          payoutsSimulated={env.PAYOUTS_SIMULATED}
        />
        <LiveUpdates />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </SidebarProvider>
  );
}

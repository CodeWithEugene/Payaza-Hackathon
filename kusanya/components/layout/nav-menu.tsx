"use client";

import { usePathname } from "next/navigation";
import {
  BarChart3,
  Code2,
  Coins,
  Contact,
  FileText,
  LayoutDashboard,
  PlusCircle,
  Settings,
  ShieldAlert,
  Users,
} from "lucide-react";
import { SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

const NAV = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/invoices/new", label: "New Invoice", icon: PlusCircle },
  { href: "/app/invoices", label: "Invoices", icon: FileText },
  { href: "/app/payments", label: "Payments", icon: Coins },
  { href: "/app/review", label: "Risk Queue", icon: ShieldAlert },
  { href: "/app/partners", label: "Partners", icon: Users },
  { href: "/app/buyers", label: "Buyers", icon: Contact },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/app/developers", label: "Developers", icon: Code2 },
  { href: "/app/settings", label: "Settings", icon: Settings },
] as const;

/** Longest matching href wins, so /app/invoices/new never also lights Invoices. */
function activeHref(pathname: string): string | null {
  const matches = NAV.filter((n) => pathname === n.href || (n.href !== "/app" && pathname.startsWith(`${n.href}/`)));
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}

export function NavMenu({ reviewCount }: { reviewCount: number }) {
  const active = activeHref(usePathname() ?? "/app");
  return (
    <SidebarMenu>
      {NAV.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton asChild tooltip={item.label} isActive={item.href === active}>
            <a href={item.href} aria-current={item.href === active ? "page" : undefined}>
              <item.icon />
              <span>{item.label}</span>
            </a>
          </SidebarMenuButton>
          {item.href === "/app/review" && reviewCount > 0 ? (
            <SidebarMenuBadge className="bg-destructive/10 text-destructive">{reviewCount}</SidebarMenuBadge>
          ) : null}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

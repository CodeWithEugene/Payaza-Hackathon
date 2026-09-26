import {
  BarChart3,
  Coins,
  Contact,
  LayoutDashboard,
  PlusCircle,
  FileText,
  Settings,
  ShieldAlert,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { DemoOutboxButton } from "@/components/layout/demo-outbox";

const NAV = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/invoices/new", label: "New invoice", icon: PlusCircle },
  { href: "/app/invoices", label: "Invoices", icon: FileText },
  { href: "/app/payments", label: "Payments", icon: Coins },
  { href: "/app/review", label: "Risk queue", icon: ShieldAlert },
  { href: "/app/partners", label: "Partners", icon: Users },
  { href: "/app/buyers", label: "Buyers", icon: Contact },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function AppSidebar(props: {
  businessName: string;
  reviewCount: number;
}) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/app">
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg font-mono text-sm font-semibold">
                  k.
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">kusanya</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {props.businessName}
                  </span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild tooltip={item.label}>
                    <a href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </a>
                  </SidebarMenuButton>
                  {item.href === "/app/review" && props.reviewCount > 0 ? (
                    <SidebarMenuBadge className="bg-destructive/10 text-destructive">
                      {props.reviewCount}
                    </SidebarMenuBadge>
                  ) : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <DemoOutboxButton />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

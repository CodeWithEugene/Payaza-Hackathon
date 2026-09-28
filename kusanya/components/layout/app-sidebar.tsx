import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { DemoOutboxButton } from "@/components/layout/demo-outbox";
import { KusanyaMark } from "@/components/brand/logo";
import { NavMenu } from "@/components/layout/nav-menu";

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
                <span className="k-brand-tile flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <KusanyaMark className="size-5" />
                </span>
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
            <NavMenu reviewCount={props.reviewCount} />
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

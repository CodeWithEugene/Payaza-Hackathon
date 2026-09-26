import { FlaskConical } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { UserMenu } from "@/components/layout/user-menu";
import { ModeToggle } from "@/components/mode-toggle";

export function Topbar(props: { userName: string | null; demoMode: boolean }) {
  return (
    <header className="bg-background/80 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      <div className="ml-2 flex items-center gap-2">
        {props.demoMode && (
          <Badge variant="secondary">
            <FlaskConical data-icon="inline-start" />
            DEMO MODE · synthetic Payaza payloads
          </Badge>
        )}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <ModeToggle />
        <UserMenu userName={props.userName} />
      </div>
    </header>
  );
}

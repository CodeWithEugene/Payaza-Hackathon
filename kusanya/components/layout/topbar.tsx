import { FlaskConical, TestTube } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { UserMenu } from "@/components/layout/user-menu";
import { ModeToggle } from "@/components/mode-toggle";

interface TopbarProps {
  userName: string | null;
  demoMode: boolean;
  /** Live Payaza keys on the test tenant: real sandbox rails. */
  sandbox: boolean;
  payoutsSimulated: boolean;
}

export function Topbar(props: TopbarProps) {
  return (
    <header className="k-topbar top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur-md">
      <SidebarTrigger className="-ml-1" />
      <div className="ml-2 flex min-w-0 items-center gap-2">
        {props.demoMode && (
          <Badge variant="secondary">
            <FlaskConical data-icon="inline-start" />
            DEMO MODE<span className="hidden md:inline"> · synthetic Payaza payloads</span>
          </Badge>
        )}
        {props.sandbox && (
          <Badge variant="outline">
            <TestTube data-icon="inline-start" />
            PAYAZA SANDBOX
            <span className="hidden md:inline">
              {" · real test rails"}
              {props.payoutsSimulated ? " · payouts simulated" : ""}
            </span>
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

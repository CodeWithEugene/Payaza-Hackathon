"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface NavItem {
  id: string;
  label: string;
  method?: "GET" | "POST";
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/** Offset below the sticky header at which a section counts as "current". */
const ACTIVE_OFFSET_PX = 120;

/** Highlight the last section whose top has scrolled past the header. */
function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  useEffect(() => {
    const targets = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const passed = targets.filter((t) => t.getBoundingClientRect().top <= ACTIVE_OFFSET_PX);
      setActive((passed[passed.length - 1] ?? targets[0]!).id);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("hashchange", onScroll);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("hashchange", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ids]);
  return active;
}

function NavLinks({ groups, active, onNavigate }: { groups: NavGroup[]; active: string | null; onNavigate?: () => void }) {
  return (
    <nav aria-label="Documentation sections" className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-1">
          <p className="text-muted-foreground px-2 text-xs font-medium tracking-wide uppercase">{group.title}</p>
          <ul className="flex flex-col">
            {group.items.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={onNavigate}
                  aria-current={active === item.id ? "location" : undefined}
                  className={cn(
                    "hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    active === item.id ? "bg-muted text-foreground font-medium" : "text-muted-foreground",
                  )}
                >
                  {item.method ? (
                    <span
                      className={cn(
                        "w-9 shrink-0 font-mono text-[0.65rem] font-semibold",
                        item.method === "GET" ? "text-primary" : "text-foreground",
                      )}
                    >
                      {item.method}
                    </span>
                  ) : null}
                  <span className="truncate">{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Sticky sidebar on desktop; collapsible "On This Page" panel on mobile. */
export function DocsNav({ groups }: { groups: NavGroup[] }) {
  const ids = groups.flatMap((g) => g.items.map((i) => i.id));
  const [idsKey] = useState(ids);
  const active = useActiveSection(idsKey);
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="lg:hidden">
        <Collapsible open={open} onOpenChange={setOpen} className="border-border bg-card rounded-lg border">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between">
              On This Page
              <ChevronDown data-icon="inline-end" className={cn("transition-transform", open && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="border-border border-t p-2">
            <NavLinks groups={groups} active={active} onNavigate={() => setOpen(false)} />
          </CollapsibleContent>
        </Collapsible>
      </div>
      <aside className="hidden lg:block">
        <div className="sticky top-20 max-h-[calc(100svh-6rem)] overflow-y-auto pr-2 pb-8">
          <NavLinks groups={groups} active={active} />
        </div>
      </aside>
    </>
  );
}

"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface OutboxItem {
  to: string;
  subject: string;
  tag: string;
  at: string;
}

/** Demo Mode outbox — proves notifications fire without external keys. */
export function DemoOutboxButton() {
  const { data } = useQuery({
    queryKey: ["demo-outbox"],
    queryFn: async () => {
      const r = await fetch("/api/demo/outbox");
      return r.ok ? ((await r.json()) as OutboxItem[]) : [];
    },
    refetchInterval: 5000,
  });
  const items = data ?? [];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
          <Mail className="size-4" />
          <span className="text-xs">Demo Outbox</span>
          {items.length > 0 && (
            <Badge variant="secondary" className="ml-auto rounded-full px-1.5">
              {items.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
          Emails & SMS the app “sent” (Demo Mode console)
        </div>
        <ScrollArea className="h-64">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Nothing yet. Send an invoice or take a payment.
            </p>
          ) : (
            <ul className="divide-y">
              {items.map((m, i) => (
                <li key={i} className="px-3 py-2 text-xs">
                  <div className="font-medium leading-tight">{m.subject}</div>
                  <div className="text-muted-foreground">
                    → {m.to} · {m.tag} ·{" "}
                    {new Date(m.at).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

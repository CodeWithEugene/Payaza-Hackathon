"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      {/* Single global TooltipProvider — the installed shadcn Tooltip is the
          un-wrapped Radix Root, so every Tooltip (sidebar rail, charts, partner
          split note, wizard confidence) needs one ancestor provider. */}
      <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}

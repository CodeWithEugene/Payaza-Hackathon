"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * SSE live updates (build.md §8.3): subscribes to /api/events and invalidates
 * the relevant queries as money moves — webhook → DB → SSE → UI in ~1s.
 */
export function LiveUpdates() {
  const qc = useQueryClient();
  useEffect(() => {
    const es = new EventSource("/api/events");
    const invalidate = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as { type?: string; entityId?: string };
        switch (data.type) {
          case "invoice.updated":
            qc.invalidateQueries({ queryKey: ["invoices"] });
            qc.invalidateQueries({ queryKey: ["dashboard"] });
            if (data.entityId) qc.invalidateQueries({ queryKey: ["invoice", data.entityId] });
            break;
          case "transaction.updated":
            qc.invalidateQueries({ queryKey: ["invoices"] });
            qc.invalidateQueries({ queryKey: ["payments"] });
            qc.invalidateQueries({ queryKey: ["dashboard"] });
            break;
          case "payout.updated":
            qc.invalidateQueries({ queryKey: ["payments"] });
            qc.invalidateQueries({ queryKey: ["wallets"] });
            qc.invalidateQueries({ queryKey: ["invoices"] });
            qc.invalidateQueries({ queryKey: ["dashboard"] });
            break;
          case "reminder.updated":
            qc.invalidateQueries({ queryKey: ["invoices"] });
            break;
          case "risk.updated":
            qc.invalidateQueries({ queryKey: ["review-queue"] });
            break;
        }
      } catch {
        /* ignore malformed */
      }
    };
    for (const t of ["invoice.updated", "transaction.updated", "payout.updated", "reminder.updated", "risk.updated"]) {
      es.addEventListener(t, invalidate as EventListener);
    }
    return () => es.close();
  }, [qc]);
  return null;
}

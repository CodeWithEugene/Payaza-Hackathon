import "server-only";

/**
 * In-process event bus for SSE live updates (build.md §8.3). Single-instance
 * (PGlite/dev/demo + Vercel function = one writer per request) — adequate for
 * MVP; v1 swaps to Postgres LISTEN/NOTIFY or Pusher with the same interface.
 */

export interface LiveEvent {
  type:
    | "invoice.updated"
    | "transaction.updated"
    | "payout.updated"
    | "reminder.updated"
    | "risk.updated"
    | "demo.outbox";
  businessId: string;
  entityId?: string;
  at: string;
  data?: Record<string, unknown>;
}

type Listener = (e: LiveEvent) => void;

const listeners = new Map<string, Set<Listener>>();

export function subscribe(businessId: string, fn: Listener): () => void {
  let set = listeners.get(businessId);
  if (!set) {
    set = new Set();
    listeners.set(businessId, set);
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) listeners.delete(businessId);
  };
}

export function publish(e: LiveEvent): void {
  const set = listeners.get(e.businessId);
  if (!set) return;
  for (const fn of set) {
    try {
      fn(e);
    } catch (err) {
      console.error("[events] listener error:", err);
    }
  }
}

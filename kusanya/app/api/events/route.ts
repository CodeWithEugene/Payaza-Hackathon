import { subscribe } from "@/lib/services/events";
import { routeSession, err } from "@/lib/api/http";

/**
 * GET /api/events — SSE stream of live business events (invoice/txn/payout
 * updates). Client: EventSource + TanStack Query invalidation (build.md §8.3).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await routeSession(req);
  if (!session) return err(401, "Not signed in.");
  const businessId = session.businessId;

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      send("ready", { businessId });
      const unsub = subscribe(businessId, (e) => {
        try {
          send(e.type, e);
        } catch {
          /* client gone */
        }
      });
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(enc.encode(": ping\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsub();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

import { handle, err, routeSession } from "@/lib/api/http";
import { mustGetInvoice } from "@/lib/services/invoices";
import { invoiceWaterfall } from "@/lib/services/waterfall";
import { db } from "@/lib/db/client";
import { transactions, reminders } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

/**
 * GET /api/invoices/[id]/status — authenticated polling for invoice +
 * transaction + reminder state (SSE alternative; TanStack Query refetch).
 */
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await routeSession(req);
  if (!session) return err(401, "Not signed in.");
  const { id } = await params;

  return handle(async () => {
    const invoice = await mustGetInvoice(id, session.businessId);
    const txns = await db
      .select({
        id: transactions.id,
        kind: transactions.kind,
        channel: transactions.channel,
        status: transactions.status,
        currency: transactions.currency,
        amountMinor: transactions.amountMinor,
        feeMinor: transactions.feeMinor,
        netMinor: transactions.netMinor,
        occurredAt: transactions.occurredAt,
        reference: transactions.merchantReference,
      })
      .from(transactions)
      .where(eq(transactions.invoiceId, id))
      .orderBy(desc(transactions.createdAt));
    const rems = await db
      .select({
        id: reminders.id,
        status: reminders.status,
        scheduledAt: reminders.scheduledAt,
        sentAt: reminders.sentAt,
        channel: reminders.channel,
        draftedBy: reminders.draftedBy,
      })
      .from(reminders)
      .where(eq(reminders.invoiceId, id))
      .orderBy(desc(reminders.scheduledAt));
    const waterfall = await invoiceWaterfall(invoice);
    return {
      invoice: {
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        currency: invoice.currency,
        amountMinor: invoice.amountMinor,
        dueAt: invoice.dueAt,
      },
      transactions: txns,
      reminders: rems,
      waterfall,
    };
  });
}

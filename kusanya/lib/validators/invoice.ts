import { z } from "zod";

/**
 * Wire validators shared by server actions + client forms.
 * NOT a "use server" module — Next only allows async-function exports there,
 * so schemas live here and actions import them.
 */

export const buyerNewSchema = z.object({
  name: z.string().min(2).max(160),
  kind: z.enum(["person", "company"]).default("person"),
  country: z.string().length(2).default("KE"),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  phone: z.string().max(16).optional().or(z.literal("")).nullable(),
});

export const invoiceItemSchema = z.object({
  description: z.string().min(1).max(500),
  qty: z.number().positive().max(1_000_000),
  unitPriceMinor: z.number().int().min(0).nullable(),
});

export const createInvoiceSchema = z.object({
  buyer: z.union([z.object({ existingId: z.string() }), buyerNewSchema]),
  items: z.array(invoiceItemSchema).max(50),
  totalMinor: z.number().int().positive(),
  currency: z.enum(["USD", "KES", "UGX", "TZS"]),
  dueAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  feeBearer: z.enum(["business", "customer"]).default("business"),
  extractionId: z.string().nullable().optional(),
  sendNow: z.boolean().default(true),
});

export type CreateInvoiceInput = z.input<typeof createInvoiceSchema>;

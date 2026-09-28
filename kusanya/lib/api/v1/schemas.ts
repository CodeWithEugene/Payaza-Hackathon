import { z } from "zod";
import { invoiceStatusEnum, txnKindEnum, txnStatusEnum } from "@/lib/db/schema";

/**
 * Public API v1 request schemas (Zod). Wire format is snake_case; money is
 * integer minor units (string preferred, JSON integer accepted).
 */

export const CURRENCY_VALUES = ["USD", "KES", "UGX", "TZS"] as const;
export const INVOICE_STATUS_VALUES = invoiceStatusEnum.enumValues;
export const PAYMENT_KIND_VALUES = txnKindEnum.enumValues;
export const PAYMENT_STATUS_VALUES = txnStatusEnum.enumValues;

export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;
const MAX_MINOR = 999_999_999_999; // 12 digits: far above any real invoice

/** Minor units: "115000" or 115000 → 115000 (integer, non-negative). */
export const minorAmountSchema = z
  .union([
    z.string().regex(/^\d{1,12}$/, "Must be an integer string of minor units, e.g. \"115000\"."),
    z.number().int("Must be an integer number of minor units.").nonnegative(),
  ])
  .transform((v) => Number(v))
  .refine((v) => v <= MAX_MINOR, "Amount is too large.");

/** Positive quantity with at most two decimal places (numeric(12,2) column). */
const quantitySchema = z
  .number()
  .positive()
  .max(1_000_000)
  .refine((q) => Math.abs(q * 100 - Math.round(q * 100)) < 1e-6, "Quantity allows at most two decimal places.");

export const lineItemSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: quantitySchema,
  unit_price_minor: minorAmountSchema,
});

export const buyerInputSchema = z
  .object({
    id: z.string().trim().min(1).max(64).optional(),
    name: z.string().trim().min(2).max(160).optional(),
    email: z.string().trim().email().max(254).nullish(),
    phone: z
      .string()
      .trim()
      .regex(/^\+?\d{7,15}$/, "Use international format digits, e.g. +254712345678.")
      .nullish(),
    country: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/, "Use a two-letter ISO country code, e.g. AE.")
      .transform((c) => c.toUpperCase())
      .optional(),
    kind: z.enum(["person", "company"]).optional(),
  })
  .superRefine((b, ctx) => {
    if (!b.id && !b.name) {
      ctx.addIssue({ code: "custom", message: "Provide buyer.id (existing buyer) or buyer.name (new buyer).", path: ["name"] });
    }
  });

const dueDateSchema = z.union([z.iso.date(), z.iso.datetime({ offset: true })], {
  error: "Use a date (2026-10-15) or an ISO 8601 date-time.",
});

export const createInvoiceBodySchema = z.object({
  buyer: buyerInputSchema,
  currency: z.enum(CURRENCY_VALUES),
  line_items: z.array(lineItemSchema).min(1).max(50),
  due_date: dueDateSchema.nullish(),
  notes: z.string().max(2000).nullish(),
  fee_bearer: z.enum(["business", "customer"]).default("business"),
  extraction_id: z.string().trim().min(1).max(64).nullish(),
  send: z.boolean().default(false),
});

export type CreateInvoiceBody = z.output<typeof createInvoiceBodySchema>;

/** Integer math: round(quantity × unit price) per line, in minor units. */
export function lineTotalMinor(quantity: number, unitPriceMinor: number): number {
  const hundredths = Math.round(quantity * 100);
  return Math.round((hundredths * unitPriceMinor) / 100);
}

export function invoiceTotalMinor(items: CreateInvoiceBody["line_items"]): number {
  return items.reduce((sum, it) => sum + lineTotalMinor(it.quantity, it.unit_price_minor), 0);
}

/** Date-only values are stored as midnight UTC; date-times are normalised to ISO. */
export function dueDateToIso(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : new Date(value).toISOString();
}

const pageSchema = z.coerce.number().int().min(1).max(10_000).default(1);
const limitSchema = z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT);

export const listInvoicesQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : []))
    .pipe(z.array(z.enum(INVOICE_STATUS_VALUES))),
  page: pageSchema,
  limit: limitSchema,
});

export const listPaymentsQuerySchema = z.object({
  invoice_id: z.string().trim().min(1).max(64).optional(),
  kind: z.enum(PAYMENT_KIND_VALUES).optional(),
  status: z.enum(PAYMENT_STATUS_VALUES).optional(),
  page: pageSchema,
  limit: limitSchema,
});

export const listBuyersQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
});

export const extractBodySchema = z.object({
  text: z.string().trim().min(3, "Send the order text (at least a few words).").max(20_000),
});

/** URLSearchParams → plain object (last value wins) for Zod parsing. */
export function queryObject(url: string): Record<string, string> {
  return Object.fromEntries(new URL(url).searchParams.entries());
}

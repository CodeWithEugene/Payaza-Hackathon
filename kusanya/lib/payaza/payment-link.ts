import { minorToMajor } from "@/lib/money/format";
import type { CurrencyCode } from "@/lib/money/currencies";
import type { CreatePaymentLinkRequest } from "./types";

/**
 * Payment-link country must MATCH the currency (observed against the sandbox
 * 2026-09-28): USD+KEN → "Currency not supported", USD+USA → 200.
 */
export const PAYMENT_LINK_COUNTRY: Record<CurrencyCode, CreatePaymentLinkRequest["country_code"]> = {
  USD: "USA",
  KES: "KEN",
  UGX: "UGA",
  TZS: "TZA",
};

export interface PaymentLinkInvoice {
  number: string;
  token: string;
  currency: CurrencyCode;
  amountMinor: number;
  feeBearer: string;
}

/**
 * Pure request builder for finalizeInvoice.
 *  - payment_link_name is unique ACCOUNT-WIDE on Payaza ("This name is
 *    unavailable"), and invoice numbers repeat after a demo reset, so the name
 *    carries the token tail.
 *  - custom_url allows only /^[a-z0-9-]+$/ (max 60); tokens contain "_".
 *  - redirect_url is https-only: Payaza's edge answers a localhost URL with a
 *    bare 403 "Forbidden".
 */
export function buildPaymentLinkRequest(
  inv: PaymentLinkInvoice,
  businessName: string,
  appUrl: string,
): CreatePaymentLinkRequest {
  const tokenSlug = inv.token
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const redirect = `${appUrl}/pay-done?ref=${encodeURIComponent(inv.token)}`;
  return {
    payment_link_name: `Invoice ${inv.number} ${tokenSlug.slice(-8)}`,
    payment_description: `Invoice ${inv.number} from ${businessName}`,
    has_fixed_amount: true,
    payment_amount: minorToMajor(inv.currency, inv.amountMinor), // wire = major units
    country_code: PAYMENT_LINK_COUNTRY[inv.currency],
    currency_code: inv.currency,
    custom_url: `ksn-${tokenSlug.slice(0, 50)}`,
    collect_customer_first_and_last_name: true,
    collect_customer_email: true,
    fee_bearer_type: inv.feeBearer === "customer" ? "Customer" : "Business",
    ...(redirect.startsWith("https://") ? { redirect_url: redirect } : {}),
  };
}

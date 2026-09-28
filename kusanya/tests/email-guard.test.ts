import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isDeliverable } from "@/lib/notify/email";
import { SEED_EMAILS } from "@/lib/notify/seed-emails";
import { merchantPaidEmail, receiptEmail } from "@/lib/notify/templates";

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g;

describe("email delivery guard", () => {
  it("covers every address the demo seed uses, so resets never email strangers", () => {
    const seed = readFileSync(join(__dirname, "../lib/demo/seed.ts"), "utf8");
    for (const address of seed.match(EMAIL_RE) ?? []) {
      expect(SEED_EMAILS.has(address.toLowerCase()), `${address} missing from SEED_EMAILS`).toBe(true);
      expect(isDeliverable(address)).toBe(false);
    }
  });

  it("blocks reserved test domains and malformed input, allows real addresses", () => {
    expect(isDeliverable("someone@shop.test")).toBe(false);
    expect(isDeliverable("not an email")).toBe(false);
    expect(isDeliverable("AP@GlobalFoods.com")).toBe(false);
    expect(isDeliverable("eugenegabriel.ke@gmail.com")).toBe(true);
  });
});

describe("payment emails", () => {
  it("merchant email carries the amount, buyer, method and a link, with no dashes", () => {
    const html = merchantPaidEmail({
      merchantName: "Wanjiru",
      invoiceNumber: "KSN-2026-0008",
      buyerName: "Dubai Fresh FZE",
      amountDisplay: "USD 1,150.00",
      methodDisplay: "Card (Payaza Checkout)",
      paidAt: "2026-09-28 20:31 UTC",
      invoiceUrl: "https://kusanya.codewitheugene.top/app/invoices/inv_x",
    });
    for (const text of ["USD 1,150.00", "Dubai Fresh FZE", "Card (Payaza Checkout)", "View Invoice", "you have a Kusanya account"]) {
      expect(html).toContain(text);
    }
    expect(html).not.toMatch(/[–—]/);
  });

  it("buyer receipt offers the receipt download when a URL is given", () => {
    const html = receiptEmail({
      buyerName: "Susan",
      invoiceNumber: "KSN-2026-0008",
      amountDisplay: "USD 1,150.00",
      reference: "KSN-2026-0008",
      paidAt: "today",
      receiptUrl: "https://kusanya.codewitheugene.top/api/buyer/receipt?token=tok_x",
    });
    expect(html).toContain("Download Receipt");
    expect(html).toContain("sent you an invoice");
  });
});

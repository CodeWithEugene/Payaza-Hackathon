import { describe, expect, it } from "vitest";
import { con, end, menu, normalizeInvoiceNumber, shortMoney, steps, USSD_MAX_CHARS } from "@/lib/ussd/screens";
import { toE164 } from "@/lib/notify/sms";

describe("USSD screens", () => {
  it("prefixes CON and END and splits the answer path", () => {
    expect(con("Hi")).toBe("CON Hi");
    expect(end("Bye")).toBe("END Bye");
    expect(steps("")).toEqual([]);
    expect(steps(" 3*2* 1*5000 ")).toEqual(["3", "2", "1", "5000"]);
    expect(steps(undefined)).toEqual([]);
  });

  it("numbers menu options and keeps every screen within the USSD limit", () => {
    expect(menu("Pick", ["A", "B"])).toBe("CON Pick\n1. A\n2. B");
    expect(end("x".repeat(400)).length).toBeLessThanOrEqual(USSD_MAX_CHARS + 4);
  });

  it("reads invoice numbers typed on a keypad", () => {
    expect(normalizeInvoiceNumber("8", 2026)).toBe("KSN-2026-0008");
    expect(normalizeInvoiceNumber("2026-0008")).toBe("KSN-2026-0008");
    expect(normalizeInvoiceNumber("KSN20260012")).toBe("KSN-2026-0012");
    expect(normalizeInvoiceNumber("")).toBeNull();
    expect(normalizeInvoiceNumber("123456")).toBeNull();
  });

  it("shortens whole amounts for tight screens", () => {
    expect(shortMoney("KES 48,500.00")).toBe("KES 48,500");
    expect(shortMoney("USD 1,150.50")).toBe("USD 1,150.50");
  });

  it("normalizes phone numbers for SMS", () => {
    expect(toE164("0712345678")).toBe("+254712345678");
    expect(toE164("254712345678")).toBe("+254712345678");
    expect(toE164("+254 712 345 678")).toBe("+254712345678");
  });
});

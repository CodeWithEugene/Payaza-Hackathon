import { describe, it, expect } from "vitest";
import {
  fromNumericColumn,
  toNumericColumn,
  parseAmountToMinor,
  formatMinor,
  formatMoney,
  formatMoneySymbol,
  minorToMajor,
  majorToMinor,
} from "@/lib/money/format";
import { minorFactor, decimals, isCurrency, currencySymbol } from "@/lib/money/currencies";

describe("currencies", () => {
  it("minor factor / decimals per currency", () => {
    expect(decimals("USD")).toBe(2);
    expect(decimals("KES")).toBe(2);
    expect(decimals("UGX")).toBe(0);
    expect(decimals("TZS")).toBe(0);
    expect(minorFactor("USD")).toBe(100);
    expect(minorFactor("UGX")).toBe(1);
  });
  it("isCurrency guards", () => {
    expect(isCurrency("USD")).toBe(true);
    expect(isCurrency("usd")).toBe(false); // codes are upper-case canonical
    expect(isCurrency("EUR")).toBe(false);
  });
  it("symbols", () => {
    expect(typeof currencySymbol("KES")).toBe("string");
  });
});

describe("format: numeric column <-> minor", () => {
  it("reads integer minor from numeric string forms", () => {
    expect(fromNumericColumn("115000")).toBe(115000);
    expect(fromNumericColumn("115000.00")).toBe(115000);
    expect(fromNumericColumn(null)).toBe(0);
  });
  it("rejects non-integer minor (fail loud)", () => {
    expect(() => fromNumericColumn("115000.5")).toThrow(/non-integer/);
  });
  it("writes minor back to string", () => {
    expect(toNumericColumn(115000)).toBe("115000");
    expect(toNumericColumn(0)).toBe("0");
  });
});

describe("format: parseAmountToMinor", () => {
  it("parses plain + grouped + decimals", () => {
    expect(parseAmountToMinor("USD", "1150")).toBe(115000);
    expect(parseAmountToMinor("USD", "1,150.00")).toBe(115000);
    expect(parseAmountToMinor("KES", "48 500")).toBe(4850000);
    expect(parseAmountToMinor("USD", "2.30")).toBe(230);
  });
  it("respects zero-decimal currencies", () => {
    expect(parseAmountToMinor("UGX", "5400")).toBe(5400);
    expect(parseAmountToMinor("UGX", "5400.50")).toBeNull(); // too many decimals
  });
  it("rejects junk", () => {
    expect(parseAmountToMinor("USD", "abc")).toBeNull();
    expect(parseAmountToMinor("USD", "12.345")).toBeNull();
    expect(parseAmountToMinor("USD", "-5")).toBeNull();
  });
});

describe("format: display", () => {
  it("formatMinor currency-first with grouping", () => {
    expect(formatMinor("USD", 115000)).toBe("1,150.00");
    expect(formatMinor("KES", 14011350)).toBe("140,113.50");
    expect(formatMinor("UGX", 5400000)).toBe("5,400,000");
    expect(formatMinor("USD", -2185)).toBe("-21.85");
  });
  it("formatMoney prefixes code", () => {
    expect(formatMoney("USD", 115000)).toBe("USD 1,150.00");
  });
  it("formatMoneySymbol prefixes symbol", () => {
    expect(formatMoneySymbol("KES", 100000)).toContain("1,000.00");
  });
});

describe("format: major <-> minor round-trip", () => {
  it("round-trips 2-decimal currencies", () => {
    for (const major of [0, 0.01, 2.3, 1150, 123456.78]) {
      const minor = majorToMinor("USD", major);
      expect(minorToMajor("USD", minor)).toBeCloseTo(major, 2);
    }
  });
  it("round-trips 0-decimal currencies", () => {
    expect(majorToMinor("UGX", 5400)).toBe(5400);
    expect(minorToMajor("UGX", 5400)).toBe(5400);
  });
  it("rounds to nearest minor (float caveat documented)", () => {
    // 1.005 * 100 = 100.49999… in IEEE-754 → rounds to 100. Money ENTERS the
    // system as strings (parseAmountToMinor) in real flows; majorToMinor only
    // converts Payaza wire numbers, which are already 2dp-safe.
    expect(majorToMinor("USD", 1.005)).toBe(100);
    expect(majorToMinor("USD", 1.006)).toBe(101);
    expect(majorToMinor("USD", 11.5)).toBe(1150);
  });
});

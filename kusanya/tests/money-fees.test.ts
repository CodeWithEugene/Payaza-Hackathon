import { describe, it, expect } from "vitest";
import {
  feeBps,
  feePercent,
  applyRate,
  convertMinor,
  buildWaterfall,
  KUSANYA_TAKE_BPS,
} from "@/lib/money/fees";

describe("fee math (integer, half-up)", () => {
  it("feeBps", () => {
    expect(feeBps(112815, KUSANYA_TAKE_BPS)).toBe(1692); // 1692.225 → 1692
    expect(feeBps(10000, 150)).toBe(150); // exactly 1.5%
    expect(feeBps(1, 150)).toBe(0); // 0.015 → 0
    expect(feeBps(334, 150)).toBe(5); // 5.01 → 5
    expect(feeBps(333, 150)).toBe(5); // 4.995 → 5 (half-up)
    expect(feeBps(14323755, 250)).toBe(358094); // 358093.875 → 358094
  });
  it("feePercent", () => {
    expect(feePercent(115000, 1.9)).toBe(2185); // exactly
    expect(feePercent(4850000, 1.4)).toBe(67900); // exactly
    expect(feePercent(1000, 1.9)).toBe(19);
    expect(feePercent(999, 1.9)).toBe(19); // 18.981 → 19
  });
});

describe("applyRate (BigInt exact, half-up)", () => {
  it("USD→KES at 128.9 (2dp→2dp pure multiply)", () => {
    // 111,123 × 128.9 = 14,323,754.7 → 14,323,755
    expect(applyRate(111123, "128.900000")).toBe(14323755);
  });
  it("exact rates stay exact", () => {
    expect(applyRate(100000, "1.500000")).toBe(150000);
    expect(applyRate(1, "1.000000")).toBe(1);
  });
  it("half-up on the 6-decimal boundary", () => {
    // 3 × 0.0000005 = 0.0000015 → product/1e6 = 0 remainder 1.5 → rounds to… q=0, r=1_500_000n*? verify via symmetry:
    expect(applyRate(3000000, "0.000001")).toBe(3); // exact
    expect(applyRate(1500000, "0.000001")).toBe(2); // 1.5 → 2 half-up
    expect(applyRate(1400000, "0.000001")).toBe(1); // 1.4 → 1
  });
  it("rejects malformed rates", () => {
    expect(() => applyRate(100, "abc")).toThrow(/invalid fx rate/);
    expect(() => applyRate(100, "1.0000001")).toThrow(/invalid fx rate/); // >6dp
    expect(() => applyRate(100, "-1.5")).toThrow(/invalid fx rate/);
  });
});

describe("convertMinor across exponents", () => {
  it("USD(2dp) → UGX(0dp): 1,150.00 × 3720 = 4,278,000", () => {
    expect(convertMinor(115000, "USD", "UGX", "3720.000000")).toBe(4278000);
  });
  it("UGX(0dp) → USD(2dp) across exponents", () => {
    // 4,278,000 UGX × 0.000269 USD/UGX = 1,150.782 USD → 115,078 minor (half-up)
    expect(convertMinor(4278000, "UGX", "USD", "0.000269")).toBe(115078);
  });
  it("same currency is identity", () => {
    expect(convertMinor(12345, "KES", "KES", "999")).toBe(12345);
  });
});

describe("buildWaterfall (the transparency spine)", () => {
  const usdInput = {
    grossMinor: 115000,
    railFeeMinor: 2185,
    fxRate: "128.900000",
    settleCurrency: "KES" as const,
    splits: [{ name: "Mwalimu Logistics", bpsOrMinor: { kind: "bps" as const, value: 250 } }],
  };

  it("USD→KES full waterfall: every line exact, net = running total", () => {
    const lines = buildWaterfall(usdInput, "USD", true);
    const byKind = (k: string) => lines.filter((l) => l.kind === k);

    expect(byKind("gross")[0]).toMatchObject({ minor: 115000, currency: "USD" });
    // rail fee −2185; kusanya 1.5% of (115000−2185)=112815 → −1692
    const fees = byKind("fee");
    expect(fees[0]).toMatchObject({ minor: -2185, currency: "USD" });
    expect(fees[1]!.minor).toBe(-1692);
    // fx: (115000−2185−1692)=111123 × 128.9 → 14,323,755 KES
    expect(byKind("fx")[0]).toMatchObject({ minor: 14323755, currency: "KES" });
    // split: 250bps of 14,323,755 → 358,094
    expect(byKind("split")[0]).toMatchObject({ minor: -358094, currency: "KES" });
    // net: 14,323,755 − 358,094 = 13,965,661
    expect(byKind("net")[0]).toMatchObject({ minor: 13965661, currency: "KES" });
  });

  it("estimated=true marks fee/net lines as estimates (honest states)", () => {
    const lines = buildWaterfall(usdInput, "USD", true);
    const fee = lines.find((l) => l.kind === "fee")!;
    const net = lines.find((l) => l.kind === "net")!;
    expect(fee.note).toMatch(/estimate/i);
    expect(net.note).toMatch(/estimate until settlement/i);
  });

  it("estimated=false → actuals, no estimate notes on fees", () => {
    const lines = buildWaterfall(usdInput, "USD", false);
    const fee = lines.find((l) => l.kind === "fee")!;
    const net = lines.find((l) => l.kind === "net")!;
    expect(fee.note).toBeUndefined();
    expect(net.note).toBeUndefined();
  });

  it("KES→KES waterfall (no FX line): 48,500 with 1.4% momo fee", () => {
    const lines = buildWaterfall(
      { grossMinor: 4850000, railFeeMinor: feePercent(4850000, 1.4) },
      "KES",
      false,
    );
    expect(lines.some((l) => l.kind === "fx")).toBe(false);
    const net = lines.find((l) => l.kind === "net")!;
    // 4,850,000 − 67,900 = 4,782,100; kusanya 1.5% → 71,732 (71,731.5 half-up); net 4,710,368
    expect(net.minor).toBe(4710368);
    expect(net.currency).toBe("KES");
  });

  it("zero rail fee omits the fee line; zero splits omit split lines", () => {
    const lines = buildWaterfall({ grossMinor: 10000, railFeeMinor: 0 }, "KES", false);
    expect(lines.filter((l) => l.kind === "fee").length).toBe(1); // only Kusanya fee
    expect(lines.filter((l) => l.kind === "split").length).toBe(0);
  });

  it("fixed-amount split (kind minor) deducts exactly", () => {
    const lines = buildWaterfall(
      {
        grossMinor: 100000,
        railFeeMinor: 0,
        kusanyaFeeBps: 0,
        splits: [{ name: "Agent", bpsOrMinor: { kind: "minor", value: 5000 } }],
      },
      "KES",
      false,
    );
    expect(lines.find((l) => l.kind === "split")!.minor).toBe(-5000);
    expect(lines.find((l) => l.kind === "net")!.minor).toBe(95000);
  });
});

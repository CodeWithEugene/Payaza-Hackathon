import { describe, it, expect } from "vitest";
import { preparse, parseItems, ruleExtraction, extractInvoice } from "@/lib/jev/invoice-extraction";

const TODAY = new Date("2026-09-26T00:00:00Z"); // a Saturday

describe("preparse (deterministic candidate collection)", () => {
  it("collects amount candidates with currency hints", () => {
    const pre = preparse(
      "Please send 500kg of French beans at USD 2.30 per kg, total USD 1,150. Pay in 5 days.",
      TODAY,
    );
    const byMajor = (m: number) => pre.amounts.find((a) => a.major === m);
    expect(byMajor(1150)?.currencyHint).toBe("USD");
    expect(byMajor(2.3)?.currencyHint).toBe("USD");
    // NOTE: unit-attached numbers ("500kg") have no word boundary after the
    // digits, so preparse skips them BY DESIGN — quantities are parsed by
    // parseItems (line items), preparse collects money totals.
    expect(byMajor(5)).toBeDefined(); // "in 5 days"
    // keys are stable identifiers for the model to SELECT among
    expect(pre.amounts.every((a) => /^amt_\d+$/.test(a.key))).toBe(true);
    expect(pre.amounts.length).toBeLessThanOrEqual(8);
  });

  it("KSh / $ symbol hints", () => {
    const pre = preparse("Total KSh 48,500 please", TODAY);
    expect(pre.amounts.find((a) => a.major === 48500)?.currencyHint).toBe("KES");
    const pre2 = preparse("total $9,800", TODAY);
    // "$" attaches via the 4-char lookbehind hint
    expect(pre2.amounts.find((a) => a.major === 9800)?.currencyHint).toBe("USD");
  });

  it("resolves relative dates IN CODE (in N days)", () => {
    const pre = preparse("Pay in 5 days", TODAY);
    expect(pre.dates[0]?.iso).toBe("2026-10-01");
    expect(pre.dates[0]?.key).toBe("date_0");
  });

  it("resolves 'next monday' in UTC (timezone-safe)", () => {
    const pre = preparse("deliver next monday", TODAY); // Sat → Mon 2026-09-28
    expect(pre.dates[0]?.iso).toBe("2026-09-28");
  });

  it("resolves end-of-month in UTC", () => {
    const pre = preparse("settle by end of month", TODAY);
    expect(pre.dates[0]?.iso).toBe("2026-09-30");
  });

  it("dd/mm/yyyy is flagged ambiguous (Kenyan convention assumed)", () => {
    const pre = preparse("due 05/10/2026", TODAY);
    const d = pre.dates.find((c) => c.raw.includes("05/10/2026"));
    expect(d?.iso).toBe("2026-10-05");
    expect(d?.ambiguous).toBe(true);
  });

  it("extracts emails and Kenyan-format phones", () => {
    const pre = preparse(
      "Invoice susan@dubaifresh.ae, call 0722 123 456 or +254733987654",
      TODAY,
    );
    expect(pre.emails).toContain("susan@dubaifresh.ae");
    expect(pre.phones.some((p) => p.replace(/\s/g, "").startsWith("0722"))).toBe(true);
    expect(pre.phones.some((p) => p.startsWith("+254733"))).toBe(true);
  });
});

describe("parseItems", () => {
  it("parses '500kg of French beans at USD 2.30'", () => {
    const items = parseItems("Please send 500kg of French beans at USD 2.30 per kg, thanks");
    expect(items).toHaveLength(1);
    expect(items[0]!.qty).toBe(500);
    expect(items[0]!.currency).toBe("USD");
    expect(items[0]!.description.toLowerCase()).toContain("french beans");
    expect(items[0]!.description).toContain("(kg)");
    expect((items[0] as never as { _unit: number })._unit).toBe(2.3);
  });

  it("parses multiple items and 'at'/'@' separators", () => {
    const items = parseItems("650 kg manila peppers @ 63.08 and 240 bags kale at KSh 31.25");
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0]!.qty).toBe(650);
  });

  it("returns [] when nothing matches (caller falls back to total-only)", () => {
    expect(parseItems("send the usual, you know the price")).toEqual([]);
  });
});

describe("ruleExtraction (Demo Mode fallback — labeled, never faked as AI)", () => {
  const text =
    "Hi Wanjiru, please send us 500kg of French beans at USD 2.30 per kg, total USD 1,150. Ship to Dubai Fresh FZE, payment by card in 5 days. attn Susan Kamau";
  const candidates = [{ id: "buy1", name: "Dubai Fresh FZE", country: "AE" }];

  it("matches a directory buyer by token overlap", () => {
    const r = ruleExtraction({ text, buyerCandidates: candidates }, text, preparse(text, TODAY), parseItems(text), Date.now());
    expect(r.buyer.value).toBe("Dubai Fresh FZE");
    expect(r.buyerCandidateId).toBe("buy1");
    expect(r.buyer.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("picks the TOTAL (1,150), not the unit price (2.30) — minor units resolved in code", () => {
    const r = ruleExtraction({ text, buyerCandidates: candidates }, text, preparse(text, TODAY), parseItems(text), Date.now());
    expect(r.currency.value).toBe("USD");
    expect(r.total.value).toBe(115000); // USD 1,150.00 in minor units
    expect(r.total.deterministic).toBe(true); // code-resolved, never model-typed
    expect(r.total.confidence).toBeGreaterThanOrEqual(0.85); // currency-hinted
  });

  it("resolves due date in code and labels everything demo:true", () => {
    const r = ruleExtraction({ text, buyerCandidates: candidates }, text, preparse(text, TODAY), parseItems(text), Date.now());
    expect(r.dueDate.value).toBe("2026-10-01"); // TODAY + 5 days
    expect(r.dueDate.deterministic).toBe(true);
    expect(r.model).toBe("demo-rules-v1");
    expect(r.buyer.demo).toBe(true);
    expect(r.total.demo).toBe(true);
    expect((r.rawAnswers as { mode: string }).mode).toBe("rule-fallback");
  });

  it("resolves item unit prices to minor units in the invoice currency", () => {
    const r = ruleExtraction({ text, buyerCandidates: candidates }, text, preparse(text, TODAY), parseItems(text), Date.now());
    expect(r.items[0]!.unitPriceMinor).toBe(230); // USD 2.30
    expect(r.items[0]!.currency).toBe("USD");
  });

  it("firm order vs enquiry judgment", () => {
    const firm = ruleExtraction({ text, buyerCandidates: [] }, text);
    expect(firm.firmOrder.value).toBe(true);
    const enquiryText = "How much do you charge for avocados? Do you have stock?";
    const enquiry = ruleExtraction({ text: enquiryText, buyerCandidates: [] }, enquiryText);
    expect(enquiry.firmOrder.value).toBe(false);
  });

  it("guesses a new buyer name from 'attn' lines", () => {
    const t = "Please invoice us. attn Susan Kamau, 300kg kale at KSh 30, total KSh 9,000.";
    const r = ruleExtraction({ text: t, buyerCandidates: [] }, t);
    expect(r.buyer.value).toBe("Susan Kamau");
    expect(r.buyerCandidateId).toBeNull();
    expect(r.currency.value).toBe("KES");
    expect(r.total.value).toBe(900000);
  });

  it("quality score reflects how much was found (0..1)", () => {
    const full = ruleExtraction({ text, buyerCandidates: candidates }, text);
    expect(full.quality).toBe(1); // buyer + total + due + items
    const sparse = ruleExtraction({ text: "hello there", buyerCandidates: [] }, "hello there");
    expect(sparse.quality).toBeLessThan(0.5);
    expect(sparse.total.value).toBeNull();
  });
});

describe("extractInvoice (pipeline entry — Jev disabled in tests → rule fallback)", () => {
  it("falls back to labeled demo rules when Jev is unavailable", async () => {
    const text = "Send 200 cartons of avocados at USD 12 each, total USD 2,400. Pay in 3 days.";
    const r = await extractInvoice({ text, buyerCandidates: [] });
    expect(r.model).toBe("demo-rules-v1");
    expect(r.total.value).toBe(240000);
    expect(r.currency.value).toBe("USD");
    expect(r.durationMs).toBeGreaterThanOrEqual(0);
  });
});

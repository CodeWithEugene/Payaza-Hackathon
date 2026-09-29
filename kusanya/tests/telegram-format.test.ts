import { describe, expect, it } from "vitest";
import {
  encodeCallback,
  escapeHtml,
  HELP_TEXT,
  NOT_LINKED_TEXT,
  orderSummaryHtml,
  parseCallback,
  parseMessage,
  phoneKey,
} from "@/lib/telegram/format";
import { buildSystemPrompt, tidyAnswer } from "@/lib/help/llm";

describe("parseMessage", () => {
  it("reads /start with and without a link code", () => {
    expect(parseMessage("/start abcdefgh12345678")).toEqual({ kind: "start", code: "abcdefgh12345678" });
    expect(parseMessage("/start")).toEqual({ kind: "start", code: null });
    expect(parseMessage("/start <script>")).toEqual({ kind: "start", code: null });
  });

  it("accepts commands addressed to the bot and treats text as an order", () => {
    expect(parseMessage("/help@kusanya_invoice_bot")).toEqual({ kind: "help" });
    expect(parseMessage("/invoices")).toEqual({ kind: "invoices" });
    expect(parseMessage("/whatever")).toEqual({ kind: "unknown_command", name: "whatever" });
    expect(parseMessage("  Please send 500kg beans, total USD 1,150  ")).toEqual({
      kind: "order",
      text: "Please send 500kg beans, total USD 1,150",
    });
  });
});

describe("callbacks", () => {
  const id = "inv_01m3mmt6w9rgr2hjzgbxar0te3";

  it("round-trips send and discard within Telegram's 64-byte limit", () => {
    for (const action of ["send", "discard"] as const) {
      const data = encodeCallback(action, id);
      expect(Buffer.byteLength(data)).toBeLessThanOrEqual(64);
      expect(parseCallback(data)).toEqual({ action, invoiceId: id });
    }
  });

  it("rejects anything else", () => {
    expect(parseCallback("send:inv_nope")).toBeNull();
    expect(parseCallback("pay:" + id)).toBeNull();
    expect(parseCallback(undefined)).toBeNull();
  });
});

describe("reply copy", () => {
  it("escapes user content in the order summary", () => {
    const html = orderSummaryHtml({
      number: "KSN-2026-0007",
      buyerName: "<b>Evil</b> & Co",
      items: [{ description: "Beans <kg>", qty: "500" }],
      totalLabel: "$1,150.00",
      dueLabel: "2026-10-03",
      quality: 0.82,
      engine: "Jev AI",
    });
    expect(html).toContain("&lt;b&gt;Evil&lt;/b&gt; &amp; Co");
    expect(html).toContain("Beans &lt;kg&gt;");
    expect(html).toContain("82% overall confidence");
    expect(escapeHtml("a<b>&c")).toBe("a&lt;b&gt;&amp;c");
  });

  it("never uses em or en dashes in bot copy", () => {
    const sample = orderSummaryHtml({
      number: "X",
      buyerName: "Y",
      items: [],
      totalLabel: "$1",
      dueLabel: "today",
      quality: 1,
      engine: "Jev AI",
    });
    for (const text of [HELP_TEXT, NOT_LINKED_TEXT, sample]) expect(text).not.toMatch(/[–—]/);
  });
});

describe("help LLM grounding", () => {
  it("puts only the audience's articles in the system prompt", () => {
    const buyer = buildSystemPrompt("buyer");
    expect(buyer).toContain("How Do I Pay This Invoice?");
    expect(buyer).not.toContain("How Do Payouts Work?");
    expect(buildSystemPrompt("merchant")).toContain("How Do Payouts Work?");
  });

  it("tidies model output to our copy rules", () => {
    expect(tidyAnswer("**Yes** — it settles T+1 – usually.")).toBe("Yes, it settles T+1, usually.");
    expect(tidyAnswer("## Title\nBody")).toBe("Title\nBody");
    expect(tidyAnswer("a. ".repeat(600)).length).toBeLessThanOrEqual(900);
  });
});

describe("phoneKey", () => {
  it("matches the same Kenyan number however it is written", () => {
    const key = "254746152008";
    expect(phoneKey("0746152008")).toBe(key);
    expect(phoneKey("+254 746 152 008")).toBe(key);
    expect(phoneKey("254746152008")).toBe(key);
    expect(phoneKey("746152008")).toBe(key);
  });

  it("rejects empty or too-short input", () => {
    expect(phoneKey(null)).toBeNull();
    expect(phoneKey("")).toBeNull();
    expect(phoneKey("1234")).toBeNull();
  });
});

describe("parseMessage /link", () => {
  it("recognises the link command", () => {
    expect(parseMessage("/link")).toEqual({ kind: "link" });
  });
});

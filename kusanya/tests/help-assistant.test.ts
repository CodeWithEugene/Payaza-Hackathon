import { describe, expect, it } from "vitest";
import {
  articlesFor,
  audienceForPath,
  getArticle,
  HELP_ARTICLES,
  HELP_STARTERS,
  matchByKeywords,
} from "@/lib/help/knowledge";
import { routeWithRules } from "@/lib/jev/help";
import { createRateLimiter } from "@/lib/api/rate-limit";

const SMALL_WORDS = new Set(["a", "an", "and", "or", "the", "to", "of", "in", "on", "for", "by", "at"]);

describe("help knowledge base", () => {
  it("has unique ids and starters that exist for their audience", () => {
    const ids = HELP_ARTICLES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [audience, starters] of Object.entries(HELP_STARTERS)) {
      for (const id of starters) {
        expect(getArticle(id)?.audiences).toContain(audience);
      }
    }
  });

  it("keeps user-facing copy free of em and en dashes", () => {
    for (const a of HELP_ARTICLES) {
      expect(`${a.title} ${a.answer} ${a.link?.label ?? ""}`).not.toMatch(/[–—]/);
    }
  });

  it("writes titles and link labels in Title Case (they render as buttons)", () => {
    for (const a of HELP_ARTICLES) {
      for (const label of [a.title, a.link?.label].filter(Boolean) as string[]) {
        for (const word of label.replace(/[?]/g, "").split(" ")) {
          if (SMALL_WORDS.has(word.toLowerCase()) && word === word.toLowerCase()) continue;
          expect(word[0], `"${word}" in "${label}"`).toBe(word[0]?.toUpperCase());
        }
      }
    }
  });

  it("keeps merchant-only articles away from buyers", () => {
    const buyerIds = articlesFor("buyer").map((a) => a.id);
    expect(buyerIds).not.toContain("payouts");
    expect(buyerIds).not.toContain("risk_review");
    expect(buyerIds).toContain("buyer_how_to_pay");
  });
});

describe("audienceForPath", () => {
  it("maps buyer, merchant and public routes", () => {
    expect(audienceForPath("/i/tok_abc")).toBe("buyer");
    expect(audienceForPath("/pay-done")).toBe("buyer");
    expect(audienceForPath("/app/invoices")).toBe("merchant");
    expect(audienceForPath("/")).toBe("visitor");
    expect(audienceForPath("/login")).toBe("visitor");
  });
});

describe("keyword fallback routing", () => {
  it("answers a clear merchant question directly", () => {
    const r = routeWithRules("How long until I get my money after the buyer pays?", "merchant");
    expect(r.answerId).toBe("settlement_time");
    expect(r.source).toBe("rules");
  });

  it("answers a buyer who already paid", () => {
    expect(routeWithRules("I already paid but it still says unpaid", "buyer").answerId).toBe(
      "buyer_paid_not_updated",
    );
  });

  it("returns no answer for off-topic text", () => {
    const r = routeWithRules("what's the weather in Mombasa", "visitor");
    expect(r.answerId).toBeNull();
  });

  it("ranks multi-word keyword hits above single words", () => {
    const [top] = matchByKeywords("Can I pay by Apple Pay?", "buyer");
    expect(top?.id).toBe("payment_methods");
  });
});

describe("createRateLimiter", () => {
  it("allows up to the limit per window, then blocks, then resets", () => {
    const allow = createRateLimiter({ limit: 2, windowMs: 1_000 });
    expect(allow("ip", 0)).toBe(true);
    expect(allow("ip", 10)).toBe(true);
    expect(allow("ip", 20)).toBe(false);
    expect(allow("other", 20)).toBe(true);
    expect(allow("ip", 1_000)).toBe(true);
  });
});

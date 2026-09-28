import { describe, expect, it } from "vitest";
import { payazaUrl } from "@/lib/payaza/client";

describe("payazaUrl", () => {
  it("keeps the /live base prefix for leading-slash paths", () => {
    const url = payazaUrl("https://api.payaza.africa/live", "/payout-receptor/payout");
    expect(url.href).toBe("https://api.payaza.africa/live/payout-receptor/payout");
  });

  it("tolerates a trailing slash on the base and no slash on the path", () => {
    const url = payazaUrl("https://api.payaza.africa/live/", "card/card_charge/");
    expect(url.href).toBe("https://api.payaza.africa/live/card/card_charge/");
  });
});

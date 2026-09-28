import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import {
  A11Y_INIT_SCRIPT,
  A11Y_STORAGE_KEY,
  a11yAttributes,
  DEFAULT_A11Y_PREFS,
  isDefaultA11yPrefs,
  parseA11yPrefs,
  type A11yPrefs,
} from "@/lib/a11y/prefs";

/** Run the inline <head> script against a fake document and storage. */
function runInitScript(stored: string | null): Record<string, string> {
  const attrs: Record<string, string> = {};
  runInNewContext(A11Y_INIT_SCRIPT, {
    localStorage: { getItem: (k: string) => (k === A11Y_STORAGE_KEY ? stored : null) },
    document: { documentElement: { setAttribute: (n: string, v: string) => (attrs[n] = v) } },
  });
  return attrs;
}

const ALL_ON: A11yPrefs = {
  textSize: "larger",
  highContrast: true,
  reduceMotion: true,
  underlineLinks: true,
  readableSpacing: true,
};

describe("parseA11yPrefs", () => {
  it("falls back to defaults for missing, corrupt or foreign data", () => {
    expect(parseA11yPrefs(null)).toEqual(DEFAULT_A11Y_PREFS);
    expect(parseA11yPrefs("{not json")).toEqual(DEFAULT_A11Y_PREFS);
    expect(parseA11yPrefs('"a string"')).toEqual(DEFAULT_A11Y_PREFS);
    expect(parseA11yPrefs('{"textSize":"huge","highContrast":"yes"}')).toEqual(DEFAULT_A11Y_PREFS);
  });

  it("round-trips a full prefs object", () => {
    expect(parseA11yPrefs(JSON.stringify(ALL_ON))).toEqual(ALL_ON);
    expect(isDefaultA11yPrefs(ALL_ON)).toBe(false);
    expect(isDefaultA11yPrefs(DEFAULT_A11Y_PREFS)).toBe(true);
  });
});

describe("A11Y_INIT_SCRIPT", () => {
  it("sets exactly the attributes a11yAttributes would (no flash, no drift)", () => {
    const expected = Object.fromEntries(
      Object.entries(a11yAttributes(ALL_ON)).filter(([, v]) => v !== null),
    );
    expect(runInitScript(JSON.stringify(ALL_ON))).toEqual(expected);
  });

  it("sets nothing for defaults and never throws on garbage", () => {
    expect(runInitScript(null)).toEqual({});
    expect(runInitScript("{broken")).toEqual({});
    expect(runInitScript(JSON.stringify(DEFAULT_A11Y_PREFS))).toEqual({});
  });
});

/**
 * Accessibility preferences (bottom-right menu). Stored per browser in
 * localStorage, applied as data attributes on <html> (styles in globals.css).
 * The same parse/apply logic is inlined into <head> as a tiny script so the
 * page never paints once at the wrong size or contrast.
 */

export type TextSize = "default" | "large" | "larger";

export interface A11yPrefs {
  textSize: TextSize;
  highContrast: boolean;
  reduceMotion: boolean;
  underlineLinks: boolean;
  readableSpacing: boolean;
}

export const A11Y_STORAGE_KEY = "kusanya-a11y";

export const DEFAULT_A11Y_PREFS: A11yPrefs = {
  textSize: "default",
  highContrast: false,
  reduceMotion: false,
  underlineLinks: false,
  readableSpacing: false,
};

const TEXT_SIZES: readonly TextSize[] = ["default", "large", "larger"];

/** Tolerant parse: unknown or corrupt storage falls back to defaults field by field. */
export function parseA11yPrefs(raw: string | null): A11yPrefs {
  if (!raw) return DEFAULT_A11Y_PREFS;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return DEFAULT_A11Y_PREFS;
  }
  if (!data || typeof data !== "object") return DEFAULT_A11Y_PREFS;
  const o = data as Record<string, unknown>;
  const bool = (k: keyof A11yPrefs) => (typeof o[k] === "boolean" ? (o[k] as boolean) : false);
  return {
    textSize: TEXT_SIZES.includes(o.textSize as TextSize) ? (o.textSize as TextSize) : "default",
    highContrast: bool("highContrast"),
    reduceMotion: bool("reduceMotion"),
    underlineLinks: bool("underlineLinks"),
    readableSpacing: bool("readableSpacing"),
  };
}

export function isDefaultA11yPrefs(prefs: A11yPrefs): boolean {
  return (Object.keys(DEFAULT_A11Y_PREFS) as (keyof A11yPrefs)[]).every(
    (k) => prefs[k] === DEFAULT_A11Y_PREFS[k],
  );
}

/** html data attributes for a prefs object; absent keys mean "off". */
export function a11yAttributes(prefs: A11yPrefs): Record<string, string | null> {
  return {
    "data-a11y-text": prefs.textSize === "default" ? null : prefs.textSize,
    "data-a11y-contrast": prefs.highContrast ? "high" : null,
    "data-a11y-motion": prefs.reduceMotion ? "reduce" : null,
    "data-a11y-links": prefs.underlineLinks ? "underline" : null,
    "data-a11y-spacing": prefs.readableSpacing ? "wide" : null,
  };
}

export function applyA11yPrefs(root: HTMLElement, prefs: A11yPrefs): void {
  for (const [name, value] of Object.entries(a11yAttributes(prefs))) {
    if (value === null) root.removeAttribute(name);
    else root.setAttribute(name, value);
  }
}

export function loadA11yPrefs(): A11yPrefs {
  try {
    return parseA11yPrefs(window.localStorage.getItem(A11Y_STORAGE_KEY));
  } catch {
    return DEFAULT_A11Y_PREFS; // storage blocked (private mode, policy)
  }
}

export function saveA11yPrefs(prefs: A11yPrefs): void {
  try {
    if (isDefaultA11yPrefs(prefs)) window.localStorage.removeItem(A11Y_STORAGE_KEY);
    else window.localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable: preferences still apply for this page view.
  }
}

/**
 * Inline <head> script: applies stored prefs before first paint. Kept in
 * sync with a11yAttributes by tests/a11y-prefs.test.ts.
 */
export const A11Y_INIT_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(
  A11Y_STORAGE_KEY,
)})||"null");if(!p||typeof p!=="object")return;var d=document.documentElement;if(p.textSize==="large"||p.textSize==="larger")d.setAttribute("data-a11y-text",p.textSize);if(p.highContrast===true)d.setAttribute("data-a11y-contrast","high");if(p.reduceMotion===true)d.setAttribute("data-a11y-motion","reduce");if(p.underlineLinks===true)d.setAttribute("data-a11y-links","underline");if(p.readableSpacing===true)d.setAttribute("data-a11y-spacing","wide")}catch(e){}})();`;

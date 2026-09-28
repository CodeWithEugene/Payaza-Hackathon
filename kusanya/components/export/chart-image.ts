"use client";

/**
 * Recharts → standalone SVG / PNG.
 *
 * shadcn charts colour everything through CSS variables (var(--color-x),
 * Tailwind fill utilities), which mean nothing outside the page. We clone
 * the chart's <svg>, inline each element's *computed* paint and type
 * styles (converted to plain rgb so every viewer understands them), fold
 * the HTML legend into the SVG, add a title band and the card background,
 * then optionally rasterize at 2x through a canvas.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const PAD = 16;
const TITLE_BAND = 28;

const STYLE_PROPS = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "opacity",
  "stop-color",
  "stop-opacity",
  "font-family",
  "font-size",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
  "visibility",
] as const;

const COLOR_PROPS = new Set(["fill", "stroke", "stop-color"]);

export interface ChartSnapshot {
  svg: string;
  width: number;
  height: number;
}

let probe: CanvasRenderingContext2D | null = null;
const colorCache = new Map<string, string>();

/** Any CSS colour (oklch, lab, color-mix…) → rgb()/rgba() via a 1px canvas. */
function toRgb(value: string): string {
  const v = value.trim();
  if (!v || v === "none" || v.startsWith("url(") || v.startsWith("rgb") || v.startsWith("#")) {
    return v;
  }
  const cached = colorCache.get(v);
  if (cached) return cached;
  if (!probe) {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    probe = c.getContext("2d", { willReadFrequently: true });
  }
  if (!probe) return v;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#000";
  probe.fillStyle = v;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
  const out = a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${((a ?? 0) / 255).toFixed(3)})`;
  colorCache.set(v, out);
  return out;
}

/** Web fonts are unavailable inside an SVG image: always end on a generic sans. */
function withFallbackFont(family: string): string {
  return /(sans-serif|serif|monospace|system-ui)\s*$/i.test(family)
    ? family
    : `${family}, ui-sans-serif, system-ui, sans-serif`;
}

function isTransparent(color: string): boolean {
  return !color || color === "transparent" || /rgba\([^)]*,\s*0\)$/.test(color);
}

/** url("http://host/page#id") or url("#id") → url(#id) so refs stay local. */
function localUrl(value: string): string {
  const m = /url\(\s*["']?[^"')]*?(#[^"')]+)["']?\s*\)/.exec(value);
  return m ? `url(${m[1]})` : value;
}

const VAR_ATTRS = ["fill", "stroke", "stop-color", "color"] as const;

function inlineStyles(src: Element, dst: Element): void {
  const cs = getComputedStyle(src);
  // Presentation attributes like fill="var(--color-x)" mean nothing outside
  // the page; the inlined computed style below replaces them.
  for (const attr of VAR_ATTRS) {
    if (dst.getAttribute(attr)?.includes("var(")) dst.removeAttribute(attr);
  }
  const parts: string[] = [];
  for (const prop of STYLE_PROPS) {
    let val = cs.getPropertyValue(prop);
    if (!val) continue;
    if (val.startsWith("url(")) val = localUrl(val);
    else if (COLOR_PROPS.has(prop)) val = toRgb(val);
    else if (prop === "font-family") val = withFallbackFont(val);
    parts.push(`${prop}:${val}`);
  }
  dst.setAttribute("style", parts.join(";"));
  dst.removeAttribute("class");
}

function backgroundFor(el: HTMLElement): string {
  let node: HTMLElement | null = el;
  while (node) {
    const bg = toRgb(getComputedStyle(node).backgroundColor);
    if (!isTransparent(bg)) return bg;
    node = node.parentElement;
  }
  return "rgb(255, 255, 255)";
}

/** Fold shadcn's HTML legend (swatch + label divs) into SVG rect/text. */
function legendLayer(container: HTMLElement, origin: DOMRect): SVGGElement | null {
  const legend = container.querySelector(".recharts-legend-wrapper");
  if (!legend) return null;
  const g = document.createElementNS(SVG_NS, "g");
  for (const el of Array.from(legend.querySelectorAll<HTMLElement>("*"))) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    const bg = toRgb(cs.backgroundColor);
    if (!isTransparent(bg) && r.width <= 24 && r.height <= 24) {
      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("x", String(r.left - origin.left));
      rect.setAttribute("y", String(r.top - origin.top));
      rect.setAttribute("width", String(r.width));
      rect.setAttribute("height", String(r.height));
      rect.setAttribute("rx", "2");
      rect.setAttribute("fill", bg);
      g.appendChild(rect);
    }
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType !== Node.TEXT_NODE) continue;
      const label = node.textContent?.trim();
      if (!label) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const tr = range.getBoundingClientRect();
      const text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("x", String(tr.left - origin.left));
      text.setAttribute("y", String(tr.top - origin.top + tr.height * 0.78));
      text.setAttribute("fill", toRgb(cs.color));
      text.setAttribute("font-family", withFallbackFont(cs.fontFamily));
      text.setAttribute("font-size", cs.fontSize);
      // Fallback fonts are wider than the web font: pin the measured width.
      text.setAttribute("textLength", String(tr.width));
      text.setAttribute("lengthAdjust", "spacingAndGlyphs");
      text.textContent = label;
      g.appendChild(text);
    }
  }
  return g.childNodes.length > 0 ? g : null;
}

/**
 * Run `fn` with the light theme applied, synchronously, so computed styles
 * resolve to print-friendly colours. No paint happens in between, so the
 * user never sees the switch; getComputedStyle forces the style recalc.
 */
function withLightTheme<T>(fn: () => T): T {
  const root = document.documentElement;
  const wasDark = root.classList.contains("dark");
  const prevScheme = root.style.colorScheme;
  if (!wasDark) return fn();
  root.classList.remove("dark");
  root.style.colorScheme = "light";
  try {
    return fn();
  } finally {
    root.classList.add("dark");
    root.style.colorScheme = prevScheme;
  }
}

/**
 * Snapshot the Recharts chart inside `container` as a standalone SVG,
 * always in the light theme (exports land in documents and on paper).
 */
export function snapshotChart(container: HTMLElement, title?: string): ChartSnapshot {
  return withLightTheme(() => serializeChart(container, title));
}

function serializeChart(container: HTMLElement, title?: string): ChartSnapshot {
  const svg = container.querySelector<SVGSVGElement>("svg.recharts-surface");
  if (!svg) throw new Error("No chart found to export.");
  const box = svg.getBoundingClientRect();
  const w = Math.max(1, Math.round(box.width));
  const h = Math.max(1, Math.round(box.height));

  const clone = svg.cloneNode(true) as SVGSVGElement;
  const src = [svg, ...Array.from(svg.querySelectorAll("*"))];
  const dst = [clone, ...Array.from(clone.querySelectorAll("*"))];
  src.forEach((el, i) => {
    const target = dst[i];
    if (target) inlineStyles(el, target);
  });
  const legend = legendLayer(container, box);
  if (legend) clone.appendChild(legend);

  const titleBand = title ? TITLE_BAND : 0;
  const width = w + PAD * 2;
  const height = h + PAD * 2 + titleBand;
  const cs = getComputedStyle(container);

  const root = document.createElementNS(SVG_NS, "svg");
  root.setAttribute("xmlns", SVG_NS);
  root.setAttribute("width", String(width));
  root.setAttribute("height", String(height));
  root.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const bg = document.createElementNS(SVG_NS, "rect");
  bg.setAttribute("width", String(width));
  bg.setAttribute("height", String(height));
  bg.setAttribute("fill", backgroundFor(container));
  root.appendChild(bg);

  if (title) {
    const t = document.createElementNS(SVG_NS, "text");
    t.setAttribute("x", String(PAD));
    t.setAttribute("y", String(PAD + 14));
    t.setAttribute("fill", toRgb(cs.color));
    t.setAttribute("font-family", withFallbackFont(cs.fontFamily));
    t.setAttribute("font-size", "14");
    t.setAttribute("font-weight", "600");
    t.textContent = title;
    root.appendChild(t);
  }

  clone.setAttribute("x", String(PAD));
  clone.setAttribute("y", String(PAD + titleBand));
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  clone.setAttribute("viewBox", `0 0 ${w} ${h}`);
  clone.setAttribute("overflow", "visible");
  root.appendChild(clone);

  const xml = new XMLSerializer().serializeToString(root);
  return { svg: `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`, width, height };
}

/** Rasterize a snapshot through a canvas at `scale` (2x = crisp on retina/print). */
export async function snapshotToPng(snap: ChartSnapshot, scale = 2): Promise<Blob> {
  const img = new Image();
  img.decoding = "async";
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(snap.svg)}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(snap.width * scale);
  canvas.height = Math.round(snap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, snap.width, snap.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encoding failed."))), "image/png");
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image."));
    reader.readAsDataURL(blob);
  });
}

export function chartElement(targetId: string): HTMLElement | null {
  return document.getElementById(targetId);
}

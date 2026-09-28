import { jsPDF } from "jspdf";
import { pdfText } from "../text";

/**
 * Kusanya PDF branding, shared by every builder (tables, reports, invoices,
 * receipts). Pure jsPDF: runs in Node route handlers and in the browser.
 * Palette mirrors the neutral shadcn tokens (ink = oklch 0.145, the same
 * #0a0a0a the fixed-ink logo files in public/logo use).
 */

export type Rgb = readonly [number, number, number];

export const INK: Rgb = [10, 10, 10];
export const MUTED: Rgb = [115, 115, 115];
export const RULE: Rgb = [229, 229, 229];
export const SOFT: Rgb = [245, 245, 245];

export const MARGIN = 16;
export const HEADER_BOTTOM = 30;
export const CONTENT_TOP = 38;
export const FOOTER_SPACE = 20;

export type Orientation = "portrait" | "landscape";

export function newDoc(orientation: Orientation = "portrait"): jsPDF {
  return new jsPDF({ unit: "mm", format: "a4", orientation, compress: true });
}

export function pageSize(doc: jsPDF): { width: number; height: number } {
  return {
    width: doc.internal.pageSize.getWidth(),
    height: doc.internal.pageSize.getHeight(),
  };
}

export function setColor(doc: jsPDF, rgb: Rgb, kind: "text" | "draw" | "fill"): void {
  if (kind === "text") doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  else if (kind === "draw") doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  else doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

/** The "k." mark, drawn as vectors from the 24-unit grid in public/logo. */
export function drawMark(doc: jsPDF, x: number, y: number, size: number): void {
  const s = size / 24;
  setColor(doc, INK, "draw");
  setColor(doc, INK, "fill");
  doc.setLineWidth(2 * s);
  doc.setLineCap("round");
  doc.setLineJoin("round");
  doc.line(x + 6.5 * s, y + 4 * s, x + 6.5 * s, y + 19 * s);
  doc.line(x + 6.5 * s, y + 13 * s, x + 13.5 * s, y + 6 * s);
  doc.line(x + 6.5 * s, y + 13 * s, x + 12.75 * s, y + 19 * s);
  doc.circle(x + 17.75 * s, y + 17.1 * s, 1.9 * s, "F");
  doc.setLineCap("butt");
}

export interface HeaderInput {
  /** Right-hand document label, e.g. "Invoice" (Title Case). */
  title: string;
  /** Muted line under the title, e.g. the invoice number. */
  subtitle?: string;
}

/** Pages already branded, so page-break hooks never double-draw a header. */
const branded = new WeakMap<jsPDF, Set<number>>();

/** Wordmark left, document title right, hairline rule under both (once per page). */
export function drawHeader(doc: jsPDF, input: HeaderInput): void {
  const page = doc.getCurrentPageInfo().pageNumber;
  const done = branded.get(doc) ?? new Set<number>();
  if (done.has(page)) return;
  done.add(page);
  branded.set(doc, done);

  const { width } = pageSize(doc);
  drawMark(doc, MARGIN - 1.5, 10, 11);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  setColor(doc, INK, "text");
  doc.text("kusanya", MARGIN + 8.2, 18.6);

  doc.setFontSize(12);
  doc.text(pdfText(input.title), width - MARGIN, 16.5, { align: "right" });
  if (input.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setColor(doc, MUTED, "text");
    doc.text(pdfText(input.subtitle), width - MARGIN, 21.5, { align: "right" });
  }

  setColor(doc, RULE, "draw");
  doc.setLineWidth(0.3);
  doc.line(MARGIN, HEADER_BOTTOM - 4, width - MARGIN, HEADER_BOTTOM - 4);
}

export interface StampOptions {
  /** IANA zone for server-rendered files (e.g. "Africa/Nairobi"). */
  timeZone?: string;
  /** Short zone label appended to the stamp (e.g. "EAT"). */
  zoneLabel?: string;
}

export function formatStamp(d: Date, opts: StampOptions = {}): string {
  const text = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: opts.timeZone,
  }).format(d);
  return opts.zoneLabel ? `${text} ${opts.zoneLabel}` : text;
}

/** Footer on every page: generated-at stamp, "Built on Payaza", page x of y. */
export function drawFooters(doc: jsPDF, generatedAt: Date, opts: StampOptions = {}): void {
  const total = doc.getNumberOfPages();
  const { width, height } = pageSize(doc);
  const stamp = `Generated ${formatStamp(generatedAt, opts)} · Built on Payaza`;
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    setColor(doc, RULE, "draw");
    doc.setLineWidth(0.3);
    doc.line(MARGIN, height - 14, width - MARGIN, height - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setColor(doc, MUTED, "text");
    doc.text(pdfText(stamp), MARGIN, height - 9);
    doc.text(`Page ${i} of ${total}`, width - MARGIN, height - 9, { align: "right" });
  }
}

export function setMeta(doc: jsPDF, title: string, subject: string): void {
  doc.setProperties({
    title: pdfText(title),
    subject: pdfText(subject),
    author: "Kusanya",
    creator: "Kusanya (Built on Payaza)",
  });
}

/** Start a new page when fewer than `needed` mm remain above the footer. */
export function ensureSpace(doc: jsPDF, y: number, needed: number, header: HeaderInput): number {
  const { height } = pageSize(doc);
  if (y + needed <= height - FOOTER_SPACE) return y;
  doc.addPage();
  drawHeader(doc, header);
  return CONTENT_TOP;
}

export function sectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  setColor(doc, INK, "text");
  doc.text(pdfText(text), MARGIN, y);
  return y + 5;
}

export function toArrayBuffer(doc: jsPDF): ArrayBuffer {
  return doc.output("arraybuffer");
}

import type { jsPDF } from "jspdf";
import { pdfText } from "../text";
import { INK, MARGIN, MUTED, RULE, SOFT, pageSize, setColor } from "./brand";

/** Reusable layout blocks for invoice/receipt/report pages. */

export interface Party {
  heading: string;
  lines: (string | null | undefined)[];
}

/** Two side-by-side address blocks ("From" / "Billed To"). Returns next y. */
export function drawParties(doc: jsPDF, parties: [Party, Party], y: number): number {
  const { width } = pageSize(doc);
  const colW = (width - MARGIN * 2) / 2;
  let maxY = y;
  parties.forEach((p, i) => {
    const x = MARGIN + i * colW;
    let yy = y;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setColor(doc, MUTED, "text");
    doc.text(pdfText(p.heading).toUpperCase(), x, yy);
    yy += 5;
    const lines = p.lines.filter((l): l is string => typeof l === "string" && l.length > 0);
    lines.forEach((line, li) => {
      doc.setFont("helvetica", li === 0 ? "bold" : "normal");
      doc.setFontSize(li === 0 ? 10.5 : 9);
      setColor(doc, li === 0 ? INK : MUTED, "text");
      const wrapped = doc.splitTextToSize(pdfText(line), colW - 6) as string[];
      doc.text(wrapped, x, yy);
      yy += wrapped.length * (li === 0 ? 5 : 4.4);
    });
    maxY = Math.max(maxY, yy);
  });
  return maxY + 4;
}

export interface Fact {
  label: string;
  value: string;
}

/** A soft band of label/value facts, up to 4 per row. Returns next y. */
export function drawFacts(doc: jsPDF, facts: Fact[], y: number): number {
  const { width } = pageSize(doc);
  const perRow = Math.min(4, Math.max(1, facts.length));
  const cellW = (width - MARGIN * 2) / perRow;
  const rows = Math.ceil(facts.length / perRow);
  const rowH = 13;
  setColor(doc, SOFT, "fill");
  doc.roundedRect(MARGIN, y, width - MARGIN * 2, rows * rowH + 2, 1.5, 1.5, "F");
  facts.forEach((f, i) => {
    const x = MARGIN + 4 + (i % perRow) * cellW;
    const yy = y + 5.5 + Math.floor(i / perRow) * rowH;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setColor(doc, MUTED, "text");
    doc.text(pdfText(f.label), x, yy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    setColor(doc, INK, "text");
    const v = doc.splitTextToSize(pdfText(f.value), cellW - 8) as string[];
    doc.text(v[0] ?? "", x, yy + 5);
  });
  return y + rows * rowH + 8;
}

/** Right-aligned totals ladder; the last line is emphasised. Returns next y. */
export function drawTotals(doc: jsPDF, lines: Fact[], y: number): number {
  const { width } = pageSize(doc);
  const right = width - MARGIN;
  const labelX = right - 78;
  let yy = y;
  lines.forEach((l, i) => {
    const last = i === lines.length - 1;
    if (last) {
      setColor(doc, RULE, "draw");
      doc.setLineWidth(0.3);
      doc.line(labelX, yy - 4, right, yy - 4);
    }
    doc.setFont("helvetica", last ? "bold" : "normal");
    doc.setFontSize(last ? 11 : 9);
    setColor(doc, last ? INK : MUTED, "text");
    doc.text(pdfText(l.label), labelX, yy);
    setColor(doc, INK, "text");
    doc.text(pdfText(l.value), right, yy, { align: "right" });
    yy += last ? 8 : 6;
  });
  return yy + 2;
}

/** Wrapped body paragraph in muted ink. Returns next y. */
export function drawParagraph(doc: jsPDF, text: string, y: number, size = 9): number {
  const { width } = pageSize(doc);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  setColor(doc, MUTED, "text");
  const lines = doc.splitTextToSize(pdfText(text), width - MARGIN * 2) as string[];
  doc.text(lines, MARGIN, y);
  return y + lines.length * (size * 0.45) + 3;
}

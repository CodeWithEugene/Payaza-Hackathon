import type { jsPDF } from "jspdf";
import { autoTable, type RowInput } from "jspdf-autotable";
import type { ExportColumn, ExportRow } from "../types";
import { pdfText } from "../text";
import {
  CONTENT_TOP,
  FOOTER_SPACE,
  INK,
  MARGIN,
  MUTED,
  RULE,
  SOFT,
  drawHeader,
  type HeaderInput,
} from "./brand";

/**
 * One branded autoTable call. Repeats the page header when the table breaks
 * across pages and returns the y just below the table.
 */
export interface DrawTableInput {
  columns: ExportColumn[];
  rows: ExportRow[];
  startY: number;
  header: HeaderInput;
  /** Optional footer row (e.g. totals), keyed like rows. */
  foot?: ExportRow;
  fontSize?: number;
}

export function drawTable(doc: jsPDF, input: DrawTableInput): number {
  const head: RowInput[] = [input.columns.map((c) => pdfText(c.header))];
  const body: RowInput[] = input.rows.map((r) => input.columns.map((c) => pdfText(r[c.key] ?? "")));
  const foot: RowInput[] | undefined = input.foot
    ? [input.columns.map((c) => pdfText(input.foot?.[c.key] ?? ""))]
    : undefined;

  // Right-aligned columns hold money/counts: never wrap them mid-amount.
  // Dates and references opt in to the same via `nowrap`.
  const columnStyles: Record<number, { halign: "left" | "right"; cellWidth?: "wrap" }> = {};
  input.columns.forEach((c, i) => {
    const halign = c.align === "right" ? "right" : "left";
    columnStyles[i] = c.align === "right" || c.nowrap ? { halign, cellWidth: "wrap" } : { halign };
  });

  autoTable(doc, {
    head,
    body,
    foot,
    startY: input.startY,
    margin: { top: CONTENT_TOP, left: MARGIN, right: MARGIN, bottom: FOOTER_SPACE },
    theme: "plain",
    showHead: "everyPage",
    showFoot: "lastPage",
    styles: {
      font: "helvetica",
      fontSize: input.fontSize ?? 8.5,
      textColor: [...INK],
      cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
      lineColor: [...RULE],
      lineWidth: { bottom: 0.2, top: 0, left: 0, right: 0 },
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [...SOFT],
      textColor: [...MUTED],
      fontStyle: "bold",
      fontSize: (input.fontSize ?? 8.5) - 0.5,
    },
    footStyles: {
      fillColor: [...SOFT],
      textColor: [...INK],
      fontStyle: "bold",
    },
    columnStyles,
    didParseCell: (data) => {
      const col = input.columns[data.column.index];
      if (col?.align === "right") data.cell.styles.halign = "right";
    },
    didDrawPage: () => {
      // autoTable adds pages itself; brand every page after the first
      // (redrawing an existing header in place is visually a no-op).
      if (doc.getCurrentPageInfo().pageNumber > 1) drawHeader(doc, input.header);
    },
  });

  const last = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  return (last?.finalY ?? input.startY) + 6;
}

import type { ExportColumn, ExportRow } from "../types";
import { pdfText } from "../text";
import {
  CONTENT_TOP,
  INK,
  MARGIN,
  MUTED,
  drawFooters,
  drawHeader,
  newDoc,
  setColor,
  setMeta,
  toArrayBuffer,
  type StampOptions,
} from "./brand";
import { drawTable } from "./table";

/** Any dashboard table → branded PDF (landscape when it is wide). */
export interface TablePdfInput extends StampOptions {
  title: string;
  subtitle?: string;
  businessName?: string;
  columns: ExportColumn[];
  rows: ExportRow[];
  generatedAt?: Date;
}

const LANDSCAPE_FROM_COLUMNS = 7;
const WIDE_TABLE_COLUMNS = 9;

export function buildTablePdf(input: TablePdfInput): ArrayBuffer {
  const generatedAt = input.generatedAt ?? new Date();
  const doc = newDoc(input.columns.length >= LANDSCAPE_FROM_COLUMNS ? "landscape" : "portrait");
  const header = { title: input.title, subtitle: input.businessName };
  setMeta(doc, input.title, input.businessName ?? "Kusanya export");
  drawHeader(doc, header);

  let y = CONTENT_TOP - 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  setColor(doc, INK, "text");
  doc.text(pdfText(input.title), MARGIN, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setColor(doc, MUTED, "text");
  const meta = [input.subtitle, `${input.rows.length} ${input.rows.length === 1 ? "row" : "rows"}`]
    .filter(Boolean)
    .join(" · ");
  doc.text(pdfText(meta), MARGIN, y);
  y += 6;

  if (input.rows.length === 0) {
    doc.text("Nothing to show for this view yet.", MARGIN, y + 4);
  } else {
    const fontSize = input.columns.length >= WIDE_TABLE_COLUMNS ? 7 : 8.5;
    drawTable(doc, { columns: input.columns, rows: input.rows, startY: y, header, fontSize });
  }

  drawFooters(doc, generatedAt, input);
  return toArrayBuffer(doc);
}

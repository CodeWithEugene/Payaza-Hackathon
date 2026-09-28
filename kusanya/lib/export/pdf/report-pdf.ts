import type { ExportKpi, ExportTable } from "../types";
import { pdfText } from "../text";
import {
  CONTENT_TOP,
  INK,
  MARGIN,
  MUTED,
  RULE,
  drawFooters,
  drawHeader,
  ensureSpace,
  newDoc,
  pageSize,
  sectionTitle,
  setColor,
  setMeta,
  toArrayBuffer,
  type StampOptions,
} from "./brand";
import { drawParagraph } from "./blocks";
import { drawTable } from "./table";

/**
 * Branded multi-page report: title block, KPI grid, chart images, tables.
 * Charts arrive as PNG data URLs rasterized in the browser (the builder
 * itself stays DOM-free, so it also runs under Node for tests).
 */
export interface ReportChart {
  title: string;
  description?: string;
  /** data:image/png;base64,... */
  png: string;
  widthPx: number;
  heightPx: number;
}

export interface ReportPdfInput extends StampOptions {
  title: string;
  businessName: string;
  rangeLabel: string;
  kpis: ExportKpi[];
  charts?: ReportChart[];
  tables?: ExportTable[];
  notes?: string[];
  generatedAt?: Date;
}

const KPI_COLUMNS = 2;
const KPI_HEIGHT = 22;
const MAX_CHART_HEIGHT = 95;

function drawKpis(doc: ReturnType<typeof newDoc>, kpis: ExportKpi[], y: number): number {
  const { width } = pageSize(doc);
  const gap = 4;
  const cellW = (width - MARGIN * 2 - gap * (KPI_COLUMNS - 1)) / KPI_COLUMNS;
  kpis.forEach((k, i) => {
    const col = i % KPI_COLUMNS;
    const row = Math.floor(i / KPI_COLUMNS);
    const x = MARGIN + col * (cellW + gap);
    const yy = y + row * (KPI_HEIGHT + gap);
    setColor(doc, RULE, "draw");
    doc.setLineWidth(0.3);
    doc.roundedRect(x, yy, cellW, KPI_HEIGHT, 1.5, 1.5, "S");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setColor(doc, MUTED, "text");
    doc.text(pdfText(k.label), x + 4, yy + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    setColor(doc, INK, "text");
    doc.text(pdfText(k.value), x + 4, yy + 13.5);
    if (k.hint) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      setColor(doc, MUTED, "text");
      const hint = doc.splitTextToSize(pdfText(k.hint), cellW - 8) as string[];
      doc.text(hint[0] ?? "", x + 4, yy + 18.5);
    }
  });
  const rows = Math.ceil(kpis.length / KPI_COLUMNS);
  return y + rows * (KPI_HEIGHT + gap) + 4;
}

export function buildReportPdf(input: ReportPdfInput): ArrayBuffer {
  const generatedAt = input.generatedAt ?? new Date();
  const doc = newDoc("portrait");
  const header = { title: input.title, subtitle: input.businessName };
  setMeta(doc, input.title, `${input.businessName} · ${input.rangeLabel}`);
  drawHeader(doc, header);
  const { width } = pageSize(doc);
  const contentW = width - MARGIN * 2;

  let y = CONTENT_TOP + 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  setColor(doc, INK, "text");
  doc.text(pdfText(input.title), MARGIN, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setColor(doc, MUTED, "text");
  doc.text(pdfText(`${input.businessName} · ${input.rangeLabel}`), MARGIN, y);
  y += 10;

  if (input.kpis.length > 0) {
    y = sectionTitle(doc, "Summary", y);
    y = drawKpis(doc, input.kpis, y + 1);
  }

  for (const note of input.notes ?? []) {
    y = ensureSpace(doc, y, 10, header);
    y = drawParagraph(doc, note, y, 8.5);
  }

  for (const chart of input.charts ?? []) {
    const ratio = chart.heightPx > 0 && chart.widthPx > 0 ? chart.heightPx / chart.widthPx : 0.5;
    let imgW = contentW;
    let imgH = imgW * ratio;
    if (imgH > MAX_CHART_HEIGHT) {
      imgH = MAX_CHART_HEIGHT;
      imgW = imgH / ratio;
    }
    y = ensureSpace(doc, y, imgH + 18, header);
    y = sectionTitle(doc, chart.title, y + 2);
    if (chart.description) y = drawParagraph(doc, chart.description, y, 8);
    doc.addImage(chart.png, "PNG", MARGIN, y, imgW, imgH, undefined, "FAST");
    y += imgH + 8;
  }

  for (const table of input.tables ?? []) {
    y = ensureSpace(doc, y, 30, header);
    y = sectionTitle(doc, table.title, y + 2);
    if (table.rows.length === 0) {
      y = drawParagraph(doc, "Nothing to show for this period yet.", y + 1, 8.5);
      continue;
    }
    y = drawTable(doc, { columns: table.columns, rows: table.rows, startY: y, header });
  }

  drawFooters(doc, generatedAt, input);
  return toArrayBuffer(doc);
}

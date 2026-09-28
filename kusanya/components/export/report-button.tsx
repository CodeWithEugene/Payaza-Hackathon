"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { dateStamp, safeFilename } from "@/lib/export/text";
import type { ExportKpi, ExportTable } from "@/lib/export/types";
import type { ReportChart } from "@/lib/export/pdf/report-pdf";
import { blobToDataUrl, chartElement, snapshotChart, snapshotToPng } from "./chart-image";
import { downloadBlob, pdfBlob } from "./download";

/**
 * "Download Report": branded multi-page PDF with the KPI summary, every
 * chart on the page (rasterized from the live DOM at 2x) and key tables.
 * Charts that are not on screen (empty states) are simply skipped.
 */
export interface ReportChartRef {
  targetId: string;
  title: string;
  description?: string;
}

export interface ReportButtonProps {
  title: string;
  filename: string;
  businessName: string;
  rangeLabel: string;
  kpis: ExportKpi[];
  tables: ExportTable[];
  charts?: ReportChartRef[];
  notes?: string[];
}

async function captureCharts(refs: ReportChartRef[]): Promise<ReportChart[]> {
  const out: ReportChart[] = [];
  for (const ref of refs) {
    const el = chartElement(ref.targetId);
    if (!el || !el.querySelector("svg.recharts-surface")) continue;
    const snap = snapshotChart(el);
    const png = await blobToDataUrl(await snapshotToPng(snap, 2));
    out.push({
      title: ref.title,
      description: ref.description,
      png,
      widthPx: snap.width,
      heightPx: snap.height,
    });
  }
  return out;
}

export function ReportButton({
  title,
  filename,
  businessName,
  rangeLabel,
  kpis,
  tables,
  charts = [],
  notes,
}: ReportButtonProps) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const [images, { buildReportPdf }] = await Promise.all([
        captureCharts(charts),
        import("@/lib/export/pdf/report-pdf"),
      ]);
      const pdf = buildReportPdf({ title, businessName, rangeLabel, kpis, charts: images, tables, notes });
      downloadBlob(pdfBlob(pdf), safeFilename(`${filename}-${dateStamp()}`, "pdf"));
    } catch {
      toast.error("We couldn't build the report. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" onClick={() => void download()} disabled={busy}>
      {busy ? <Spinner data-icon="inline-start" /> : <FileDown data-icon="inline-start" />}
      Download Report
    </Button>
  );
}

"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { toCsv } from "@/lib/export/csv";
import { dateStamp, safeFilename } from "@/lib/export/text";
import type { ExportColumn, ExportRow } from "@/lib/export/types";
import { downloadBlob, pdfBlob } from "./download";

/**
 * "Export" dropdown for any dashboard table: Download CSV / Download PDF.
 * Server pages pass serializable columns + already-formatted rows. The PDF
 * builder (jsPDF) is loaded on demand so it never weighs on first paint.
 */
export interface ExportMenuProps {
  /** Title Case document title, e.g. "Payments Ledger". */
  title: string;
  /** Base filename without date/extension, e.g. "kusanya-payments". */
  filename: string;
  columns: ExportColumn[];
  rows: ExportRow[];
  subtitle?: string;
  businessName?: string;
  label?: string;
  size?: "sm" | "default";
}

export function ExportMenu({
  title,
  filename,
  columns,
  rows,
  subtitle,
  businessName,
  label = "Export",
  size = "sm",
}: ExportMenuProps) {
  const [busy, setBusy] = useState(false);
  const base = `${filename}-${dateStamp()}`;

  function downloadCsv() {
    try {
      const csv = toCsv(columns, rows);
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), safeFilename(base, "csv"));
    } catch {
      toast.error("We couldn't build that CSV. Please try again.");
    }
  }

  async function downloadPdf() {
    setBusy(true);
    try {
      const { buildTablePdf } = await import("@/lib/export/pdf/table-pdf");
      const pdf = buildTablePdf({ title, subtitle, businessName, columns, rows });
      downloadBlob(pdfBlob(pdf), safeFilename(base, "pdf"));
    } catch {
      toast.error("We couldn't build that PDF. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} disabled={busy} aria-label={`${label} ${title}`}>
          {busy ? <Spinner data-icon="inline-start" /> : <Download data-icon="inline-start" />}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-44">
        <DropdownMenuItem onSelect={downloadCsv}>
          <FileSpreadsheet />
          Download CSV
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void downloadPdf()}>
          <FileText />
          Download PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

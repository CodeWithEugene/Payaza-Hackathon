"use client";

import { useState } from "react";
import { Download, FileCode2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { dateStamp, safeFilename } from "@/lib/export/text";
import { chartElement, snapshotChart, snapshotToPng } from "./chart-image";
import { downloadBlob } from "./download";

/**
 * Chart export dropdown: Download PNG (2x) / Download SVG. Points at the
 * element wrapping a shadcn ChartContainer by id, so Server Components can
 * place the menu (e.g. in a CardAction) apart from the client chart island.
 */
export interface ChartExportMenuProps {
  targetId: string;
  /** Title Case chart title, drawn into the exported image. */
  title: string;
  /** Base filename without date/extension. */
  filename: string;
}

export function ChartExportMenu({ targetId, title, filename }: ChartExportMenuProps) {
  const [busy, setBusy] = useState(false);
  const base = `${filename}-${dateStamp()}`;

  function snapshot() {
    const el = chartElement(targetId);
    if (!el) throw new Error("Chart not found.");
    return snapshotChart(el, title);
  }

  function downloadSvg() {
    try {
      const snap = snapshot();
      downloadBlob(new Blob([snap.svg], { type: "image/svg+xml;charset=utf-8" }), safeFilename(base, "svg"));
    } catch {
      toast.error("We couldn't export that chart. Please try again.");
    }
  }

  async function downloadPng() {
    setBusy(true);
    try {
      const png = await snapshotToPng(snapshot(), 2);
      downloadBlob(png, safeFilename(base, "png"));
    } catch {
      toast.error("We couldn't export that chart. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={busy} aria-label={`Export ${title} chart`}>
          {busy ? <Spinner data-icon="inline-start" /> : <Download data-icon="inline-start" />}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-44">
        <DropdownMenuItem onSelect={() => void downloadPng()}>
          <ImageIcon />
          Download PNG
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={downloadSvg}>
          <FileCode2 />
          Download SVG
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

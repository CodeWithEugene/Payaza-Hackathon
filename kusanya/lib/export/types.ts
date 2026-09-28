/**
 * Shared, serializable export shapes. Server Components build these (money
 * already formatted through lib/money/format) and hand them to client export
 * islands, so nothing here may hold a Date, function or class instance.
 */

export interface ExportColumn {
  /** Row property this column reads. */
  key: string;
  /** Header text (Title Case, no dashes). */
  header: string;
  /** Right-align numeric/money columns in the PDF. */
  align?: "left" | "right";
  /** Keep the cell on one line in the PDF (dates, references). */
  nowrap?: boolean;
}

/** One row: column key → already-formatted display string. */
export type ExportRow = Record<string, string>;

export interface ExportTable {
  title: string;
  columns: ExportColumn[];
  rows: ExportRow[];
}

export interface ExportKpi {
  label: string;
  value: string;
  hint?: string;
}

import type { ExportColumn, ExportRow } from "./types";
import { noDashes } from "./text";

/**
 * RFC 4180 CSV builder (pure, runs in Node and the browser).
 *
 * - CRLF record separators, every field quoted when it contains a comma,
 *   quote, CR or LF; embedded quotes doubled.
 * - UTF-8 BOM (on by default) so Excel opens accented names correctly.
 * - Formula-injection guard: a cell starting with = + - @ (or a tab / CR,
 *   which some spreadsheets strip before evaluating) gets a leading single
 *   quote so it is read as text, never executed.
 */

export const CSV_BOM = "﻿";
const FORMULA_TRIGGERS = new Set(["=", "+", "-", "@", "\t", "\r"]);

export function guardFormula(value: string): string {
  return value.length > 0 && FORMULA_TRIGGERS.has(value[0]!) ? `'${value}` : value;
}

export function escapeCsvField(value: string): string {
  const guarded = guardFormula(value);
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export interface CsvOptions {
  /** Prefix a UTF-8 BOM (default true). */
  bom?: boolean;
}

export function toCsv(columns: ExportColumn[], rows: ExportRow[], opts: CsvOptions = {}): string {
  const header = columns.map((c) => escapeCsvField(noDashes(c.header))).join(",");
  const body = rows.map((row) =>
    columns.map((c) => escapeCsvField(noDashes(row[c.key] ?? ""))).join(","),
  );
  const text = [header, ...body].join("\r\n") + "\r\n";
  return (opts.bom ?? true) ? CSV_BOM + text : text;
}

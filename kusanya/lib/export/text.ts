/**
 * Text hygiene for exported files.
 *
 * - `noDashes`: copy rule, no em/en dashes in anything a person reads.
 * - `pdfText`: jsPDF's built-in Helvetica only speaks WinAnsi (Latin-1-ish).
 *   Anything outside it renders as garbage, so map the common typographic
 *   characters to ASCII and replace the rest with "?".
 * - `safeFilename`: ASCII slug for Content-Disposition / download names.
 */

const DASHES = /[‒–—―−]/g;

export function noDashes(value: string): string {
  return value.replace(DASHES, "-");
}

const PDF_MAP: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "…": "...",
  "•": "*",
  "→": "->",
  "←": "<-",
  " ": " ",
  " ": " ",
  " ": " ",
  "≈": "~",
  "≤": "<=",
  "≥": ">=",
};

export function pdfText(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  let out = "";
  for (const ch of noDashes(String(value))) {
    const mapped = PDF_MAP[ch];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    const code = ch.codePointAt(0) ?? 0;
    // Printable ASCII, tab/newline, and Latin-1 supplement are safe.
    if (code === 9 || code === 10 || (code >= 32 && code <= 126) || (code >= 160 && code <= 255)) {
      out += ch;
    } else if (code === 13) {
      continue;
    } else {
      out += "?";
    }
  }
  return out;
}

/**
 * "Kusanya Invoices 2026-09-28" → "kusanya-invoices-2026-09-28.csv".
 * Only [a-z0-9._-] survive, so the name is safe inside a quoted
 * Content-Disposition header and on every filesystem.
 */
export function safeFilename(base: string, ext: string): string {
  const slug = noDashes(base)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);
  const cleanExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  return `${slug || "kusanya-export"}.${cleanExt}`;
}

/** YYYY-MM-DD in local time, for filenames. */
export function dateStamp(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

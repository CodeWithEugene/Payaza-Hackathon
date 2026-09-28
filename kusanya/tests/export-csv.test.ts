import { describe, expect, it } from "vitest";
import { CSV_BOM, escapeCsvField, guardFormula, toCsv } from "@/lib/export/csv";
import { dateStamp, noDashes, pdfText, safeFilename } from "@/lib/export/text";
import { moneyText } from "@/lib/export/format";

const columns = [
  { key: "name", header: "Buyer" },
  { key: "amount", header: "Amount", align: "right" as const },
];

describe("toCsv", () => {
  it("prefixes a UTF-8 BOM by default and can omit it", () => {
    expect(toCsv(columns, []).startsWith(CSV_BOM)).toBe(true);
    expect(toCsv(columns, [], { bom: false }).startsWith(CSV_BOM)).toBe(false);
  });

  it("writes a header row and CRLF-terminated records", () => {
    const csv = toCsv(columns, [{ name: "Acme", amount: "USD 1,150.00" }], { bom: false });
    expect(csv).toBe('Buyer,Amount\r\nAcme,"USD 1,150.00"\r\n');
  });

  it("quotes commas, doubles quotes and keeps embedded newlines inside quotes", () => {
    const csv = toCsv(
      columns,
      [{ name: 'Mama "Mboga", Ltd', amount: "line one\nline two" }],
      { bom: false },
    );
    expect(csv).toBe('Buyer,Amount\r\n"Mama ""Mboga"", Ltd","line one\nline two"\r\n');
  });

  it("fills missing keys with empty cells", () => {
    const csv = toCsv(columns, [{ name: "Only name" }], { bom: false });
    expect(csv).toBe("Buyer,Amount\r\nOnly name,\r\n");
  });

  it("guards against formula injection", () => {
    for (const payload of ["=HYPERLINK(\"x\")", "+1+1", "-2+3", "@SUM(A1)", "\tcmd"]) {
      expect(guardFormula(payload).startsWith("'")).toBe(true);
    }
    expect(guardFormula("Acme")).toBe("Acme");
    expect(escapeCsvField("=1,2")).toBe("\"'=1,2\"");
    const csv = toCsv(columns, [{ name: "=cmd|' /C calc'!A0", amount: "1" }], { bom: false });
    expect(csv.split("\r\n")[1]).toBe("'=cmd|' /C calc'!A0,1");
  });

  it("strips em and en dashes from cells and headers", () => {
    const csv = toCsv([{ key: "a", header: "From — To" }], [{ a: "1–2" }], { bom: false });
    expect(csv).toBe("From - To\r\n1-2\r\n");
  });
});

describe("text helpers", () => {
  it("builds ASCII-safe filenames", () => {
    expect(safeFilename("Kusanya Invoices 2026-09-28", "csv")).toBe("kusanya-invoices-2026-09-28.csv");
    expect(safeFilename('Invoice "KSN/2026"\r\n— ok', "PDF")).toBe("invoice-ksn-2026-ok.pdf");
    expect(safeFilename("", "pdf")).toBe("kusanya-export.pdf");
    expect(safeFilename("Café Receipt", "pdf")).toBe("cafe-receipt.pdf");
  });

  it("maps typography to WinAnsi-safe text for PDFs", () => {
    expect(pdfText("A — B → C …")).toBe("A - B -> C ...");
    expect(pdfText("Imefika ✅")).toBe("Imefika ?");
    expect(pdfText(null)).toBe("");
    expect(noDashes("a–b")).toBe("a-b");
  });

  it("stamps dates as YYYY-MM-DD", () => {
    expect(dateStamp(new Date(2026, 8, 3))).toBe("2026-09-03");
  });

  it("formats money through lib/money without float drift", () => {
    expect(moneyText("USD", "115000.00")).toBe("USD 1,150.00");
    expect(moneyText("UGX", 250000)).toBe("UGX 250,000");
    expect(moneyText("KES", null)).toBe("");
    expect(moneyText("KES", "-50")).toBe("KES -0.50");
  });
});

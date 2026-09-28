import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildTablePdf } from "@/lib/export/pdf/table-pdf";
import { buildInvoicePdf } from "@/lib/export/pdf/invoice-pdf";
import { buildReceiptPdf } from "@/lib/export/pdf/receipt-pdf";
import { buildReportPdf } from "@/lib/export/pdf/report-pdf";

/** Decode the PDF (inflating compressed content streams) into searchable text. */
function pdfToText(buf: ArrayBuffer): string {
  const bytes = Buffer.from(buf);
  const raw = bytes.toString("latin1");
  let out = raw;
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    try {
      out += inflateSync(bytes.subarray(start, end)).toString("latin1");
    } catch {
      // Not a deflate stream (e.g. image data); skip.
    }
  }
  return out;
}

function expectPdf(buf: ArrayBuffer): string {
  expect(buf.byteLength).toBeGreaterThan(1000);
  expect(Buffer.from(buf).subarray(0, 4).toString("latin1")).toBe("%PDF");
  return pdfToText(buf);
}

const FIXED_DATE = new Date("2026-09-28T09:30:00Z");
// 1x1 transparent PNG.
const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

describe("PDF builders", () => {
  it("builds a branded table PDF with every row", () => {
    const rows = Array.from({ length: 120 }, (_, i) => ({
      number: `KSN-2026-${String(i + 1).padStart(4, "0")}`,
      amount: "USD 1,150.00",
    }));
    const text = expectPdf(
      buildTablePdf({
        title: "Invoices",
        businessName: "Nyeri Coffee Exporters",
        columns: [
          { key: "number", header: "Invoice" },
          { key: "amount", header: "Amount", align: "right" },
        ],
        rows,
        generatedAt: FIXED_DATE,
        timeZone: "Africa/Nairobi",
        zoneLabel: "EAT",
      }),
    );
    expect(text).toContain("kusanya");
    expect(text).toContain("KSN-2026-0120");
    expect(text).toContain("Built on Payaza");
    expect(text).toMatch(/Page 1 of [2-9]/);
    expect(text).toMatch(/Generated 28 Sept? 2026, 12:30 EAT/);
  });

  it("builds an invoice PDF with items, totals and the payment link", () => {
    const text = expectPdf(
      buildInvoicePdf({
        business: { name: "Nyeri Coffee Exporters", country: "KE" },
        buyer: { name: "Hamburg Roasters GmbH", country: "DE", email: "ap@roasters.test" },
        number: "KSN-2026-0001",
        statusLabel: "Sent",
        issuedLabel: "1 Sep 2026",
        dueLabel: "30 Sep 2026",
        currency: "USD",
        items: [
          { description: "AA grade green coffee — 60kg bags", qty: "10", unitPrice: "USD 115.00", lineTotal: "USD 1,150.00" },
        ],
        totalDisplay: "USD 1,150.00",
        paymentUrl: "https://kusanya.test/i/tok_abc",
        notes: "Thank you.",
        generatedAt: FIXED_DATE,
      }),
    );
    expect(text).toContain("KSN-2026-0001");
    expect(text).toContain("Hamburg Roasters GmbH");
    expect(text).toContain("USD 1,150.00");
    expect(text).toContain("AA grade green coffee - 60kg bags");
    expect(text).toContain("https://kusanya.test/i/tok_abc");
    expect(text).not.toContain("—");
  });

  it("builds a merchant receipt with fees and a buyer receipt without them", () => {
    const base = {
      business: { name: "Nyeri Coffee Exporters", country: "KE" },
      buyer: { name: "Hamburg Roasters GmbH", country: "DE" },
      invoiceNumber: "KSN-2026-0001",
      invoiceTotalDisplay: "USD 1,150.00",
      statusLabel: "Paid",
      receivedTotals: ["USD 1,150.00"],
      paidOnLabel: "12 Sep 2026",
      payments: [
        {
          dateLabel: "12 Sep 2026, 10:04",
          method: "Card (Payaza Checkout)",
          merchantReference: "KSN-01J8ZK5",
          payazaReference: "PZ-778812",
          amount: "USD 1,150.00",
          fee: "USD 17.25",
          net: "USD 1,132.75",
        },
      ],
      generatedAt: FIXED_DATE,
    };
    const merchant = expectPdf(buildReceiptPdf({ ...base, audience: "merchant" }));
    expect(merchant).toContain("RCPT-KSN-2026-0001");
    expect(merchant).toContain("PZ-778812");
    expect(merchant).toContain("USD 17.25");
    expect(merchant).toContain("Payaza Fee");

    const buyer = expectPdf(buildReceiptPdf({ ...base, audience: "buyer" }));
    expect(buyer).toContain("KSN-01J8ZK5");
    expect(buyer).not.toContain("USD 17.25");
    expect(buyer).not.toContain("Payaza Fee");
  });

  it("builds a report with KPIs, a chart image and tables", () => {
    const text = expectPdf(
      buildReportPdf({
        title: "Analytics Report",
        businessName: "Nyeri Coffee Exporters",
        rangeLabel: "15 Aug 2026 to 28 Sep 2026",
        kpis: [
          { label: "Collected (USD)", value: "USD 4,600.00", hint: "Gross of completed collections" },
          { label: "Success Rate", value: "92.3%" },
        ],
        charts: [{ title: "Completed Collections", png: PNG_1PX, widthPx: 800, heightPx: 300 }],
        tables: [
          {
            title: "Top Buyers",
            columns: [
              { key: "buyer", header: "Buyer" },
              { key: "count", header: "Collections", align: "right" },
            ],
            rows: [{ buyer: "Hamburg Roasters GmbH", count: "4" }],
          },
          { title: "Empty Table", columns: [{ key: "a", header: "A" }], rows: [] },
        ],
        generatedAt: FIXED_DATE,
      }),
    );
    expect(text).toContain("Analytics Report");
    expect(text).toContain("USD 4,600.00");
    expect(text).toContain("Hamburg Roasters GmbH");
    expect(text).toContain("/Subtype /Image");
  });
});
